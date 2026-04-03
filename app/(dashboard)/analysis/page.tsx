"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { LiveECGChart } from "@/components/charts/LiveECGChart";
import { NormalDistributionChart, PoissonChart } from "@/components/charts/DistributionChart";
import { CorrelationPlot } from "@/components/charts/CorrelationPlot";
import { RegressionPlot } from "@/components/stats/RegressionPlot";
import { BayesWidget } from "@/components/stats/BayesWidget";
import { useCardioStore } from "@/lib/store";

export default function AnalysisPage() {
  const [signal, setSignal] = useState<number[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [sourceMode, setSourceMode] = useState<"live" | "simulated">("live");
  const pushECG = useCardioStore((s) => s.pushECG);
  const setBpm = useCardioStore((s) => s.setBpm);
  const bpm = useCardioStore((s) => s.bpm);
  const storeSignal = useCardioStore((s) => s.ecgBuffer);
  const lastLiveTsRef = useRef<number>(0);

  const features = useMemo(
    () => [
      ["R-peak", 0.88],
      ["P-wave", 0.71],
      ["T-wave", 0.69],
      ["QRS", 0.82],
      ["HRV", 0.64],
      ["SNR", 0.77],
    ],
    [],
  );

  const simulate = () => {
    const arr = Array.from({ length: 420 }, (_, i) => Math.sin(i / 9) * 0.35 + (i % 55 === 0 ? 0.9 : 0) + Math.random() * 0.05);
    setSignal(arr);
    setSourceMode("simulated");
    setAnalyzed(false);
  };

  useEffect(() => {
    let alive = true;
    let inFlight = false;

    const poll = async () => {
      if (!alive || inFlight) return;
      inFlight = true;
      try {
        const url = `/api/ecg/live?after_ts=${lastLiveTsRef.current}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;

        const payload = await res.json();
        const chunks = Array.isArray(payload?.chunks) ? payload.chunks : [];
        for (const c of chunks) {
          if (Array.isArray(c.signal) && c.signal.length) {
            pushECG(c.signal);
          }
          if (typeof c.bpm === "number" && c.bpm > 0) {
            setBpm(c.bpm);
          }
          if (typeof c.ts === "number" && c.ts > lastLiveTsRef.current) {
            lastLiveTsRef.current = c.ts;
          }
        }

        if (typeof payload?.latest_ts === "number" && payload.latest_ts > lastLiveTsRef.current) {
          lastLiveTsRef.current = payload.latest_ts;
        }
      } finally {
        inFlight = false;
      }
    };

    const timer = setInterval(() => {
      void poll();
    }, 700);
    void poll();

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pushECG, setBpm]);

  const liveSignal = sourceMode === "live" ? storeSignal : signal;
  const quality = useMemo(() => {
    if (!liveSignal.length) {
      return { snrDb: null as number | null, baseline: "--", noise: null as number | null, amplitude: null as number | null };
    }

    const window = liveSignal.slice(-360);
    const n = window.length;
    if (!n) {
      return { snrDb: null as number | null, baseline: "--", noise: null as number | null, amplitude: null as number | null };
    }

    let mean = 0;
    for (const v of window) mean += v;
    mean /= n;

    let varSignal = 0;
    for (const v of window) {
      const d = v - mean;
      varSignal += d * d;
    }
    varSignal /= n;

    let diffSq = 0;
    for (let i = 1; i < window.length; i++) {
      const d = window[i] - window[i - 1];
      diffSq += d * d;
    }
    const noise = Math.sqrt(diffSq / Math.max(1, window.length - 1));
    const signalRms = Math.sqrt(Math.max(varSignal, 1e-9));
    const snrDb = 20 * Math.log10(Math.max(signalRms / Math.max(noise, 1e-6), 1e-6));

    const min = Math.min(...window);
    const max = Math.max(...window);
    const amplitude = max - min;

    const baseline = Math.abs(mean) < 0.05 ? "Stable" : Math.abs(mean) < 0.12 ? "Mild drift" : "High drift";
    return { snrDb, baseline, noise, amplitude };
  }, [liveSignal]);

  return (
    <div className="space-y-4">
      <Panel title="ECG Analysis Workbench" subtitle="Upload, simulate, inspect, and export diagnostics">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="rounded-xl border border-dashed border-cyan-500/50 bg-[#041a2e] p-5 text-sm text-slate-300">
            Drop .csv, .edf, .mat file here
            <input className="mt-3 block text-xs" type="file" accept=".csv,.edf,.mat" />
          </label>
          <div className="flex items-end gap-2">
            <Button onClick={simulate}>Simulate ECG</Button>
            <Button variant="ghost" onClick={() => setSourceMode("live")}>Use Live Stream</Button>
            <Button variant="ghost" onClick={() => setAnalyzed(true)}>
              Run AI Analysis
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Waveform Viewer" subtitle="Zoomable ECG with R-peaks">
        <LiveECGChart points={liveSignal} />
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Signal Quality">
          <p className="text-sm text-slate-300">BPM: <span className="mono-data">{bpm > 0 ? bpm : "--"}</span></p>
          <p className="text-sm text-slate-300">SNR: <span className="mono-data">{quality.snrDb == null ? "--" : `${quality.snrDb.toFixed(1)} dB`}</span></p>
          <p className="text-sm text-slate-300">Baseline Wander: <span className="mono-data">{quality.baseline}</span></p>
          <p className="text-sm text-slate-300">Noise Level: <span className="mono-data">{quality.noise == null ? "--" : quality.noise.toFixed(4)}</span></p>
          <p className="text-sm text-slate-300">Peak-to-Peak: <span className="mono-data">{quality.amplitude == null ? "--" : quality.amplitude.toFixed(3)}</span></p>
        </Panel>
        <Panel title="AI Result">
          {analyzed ? (
            <div className="space-y-1 text-sm text-slate-300">
              <p>Prediction: <span className="mono-data">PVC</span></p>
              <p>Confidence: <span className="mono-data">86.2%</span></p>
              <p>Risk: <span className="mono-data">High</span></p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Run analysis to generate inference.</p>
          )}
        </Panel>
      </div>

      <Panel title="Feature Radar (normalized)">
        <div className="grid gap-2 md:grid-cols-3">
          {features.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">
              <p className="text-slate-300">{k}</p>
              <p className="mono-data text-xl">{Math.round(Number(v) * 100)}%</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Normal Distribution Overlay">
          <NormalDistributionChart />
        </Panel>
        <Panel title="Poisson PVC Frequency">
          <PoissonChart />
        </Panel>
        <Panel title="Karl Pearson Correlation">
          <CorrelationPlot />
        </Panel>
        <Panel title="Regression Trend + R²">
          <RegressionPlot />
        </Panel>
      </div>

      <Panel title="Bayes Posterior Calculator">
        <BayesWidget />
      </Panel>
    </div>
  );
}
