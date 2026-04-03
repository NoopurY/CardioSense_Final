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

type LatestPrediction = {
  predictionLabel?: string;
  arrhythmiaType?: string;
  confidence?: number;
  riskScore?: number;
};

export default function AnalysisPage() {
  const [prediction, setPrediction] = useState<LatestPrediction | null>(null);
  const pushECG = useCardioStore((s) => s.pushECG);
  const setBpm = useCardioStore((s) => s.setBpm);
  const bpm = useCardioStore((s) => s.bpm);
  const storeSignal = useCardioStore((s) => s.ecgBuffer);
  const lastLiveTsRef = useRef<number>(0);

  const loadLatestPrediction = async () => {
    const res = await fetch("/api/predictions", { cache: "no-store" });
    if (!res.ok) return;
    const list = await res.json();
    if (Array.isArray(list) && list.length > 0) {
      setPrediction(list[0] as LatestPrediction);
    }
  };

  useEffect(() => {
    void loadLatestPrediction();
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

  const liveSignal = storeSignal;
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

  const liveFeatures = useMemo(() => {
    if (!liveSignal.length) {
      return [
        ["R-peak density", "--"],
        ["Signal mean", "--"],
        ["Signal RMS", "--"],
        ["Peak-to-peak", "--"],
        ["BPM", "--"],
        ["SNR", "--"],
      ];
    }

    const window = liveSignal.slice(-360);
    const n = window.length;
    const mean = window.reduce((a, b) => a + b, 0) / Math.max(1, n);
    const rms = Math.sqrt(window.reduce((a, b) => a + b * b, 0) / Math.max(1, n));
    const min = Math.min(...window);
    const max = Math.max(...window);
    const p2p = max - min;

    let peaks = 0;
    for (let i = 1; i < window.length - 1; i++) {
      if (window[i] > window[i - 1] && window[i] >= window[i + 1] && window[i] > mean + 0.25 * Math.max(quality.amplitude ?? 0, 0.01)) {
        peaks += 1;
      }
    }
    const peakDensity = peaks / Math.max(1, window.length);

    return [
      ["R-peak density", peakDensity.toFixed(3)],
      ["Signal mean", mean.toFixed(4)],
      ["Signal RMS", rms.toFixed(4)],
      ["Peak-to-peak", p2p.toFixed(4)],
      ["BPM", bpm > 0 ? String(bpm) : "--"],
      ["SNR", quality.snrDb == null ? "--" : `${quality.snrDb.toFixed(1)} dB`],
    ];
  }, [liveSignal, bpm, quality.amplitude, quality.snrDb]);

  return (
    <div className="space-y-4">
      <Panel title="ECG Analysis Workbench" subtitle="Live-stream diagnostics from ESP32 sensor data">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="rounded-xl border border-dashed border-cyan-500/50 bg-[#041a2e] p-5 text-sm text-slate-300">
            Drop .csv, .edf, .mat file here
            <input className="mt-3 block text-xs" type="file" accept=".csv,.edf,.mat" />
          </label>
          <div className="flex items-end gap-2">
            <Button variant="ghost" onClick={() => void loadLatestPrediction()}>
              Refresh AI Result
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
          {prediction ? (
            <div className="space-y-1 text-sm text-slate-300">
              <p>Prediction: <span className="mono-data">{prediction.predictionLabel ?? prediction.arrhythmiaType ?? "--"}</span></p>
              <p>Confidence: <span className="mono-data">{typeof prediction.confidence === "number" ? `${(prediction.confidence * 100).toFixed(1)}%` : "--"}</span></p>
              <p>Risk: <span className="mono-data">{typeof prediction.riskScore === "number" ? prediction.riskScore.toFixed(1) : "--"}</span></p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No prediction available yet. Keep streaming and click Refresh AI Result.</p>
          )}
        </Panel>
      </div>

      <Panel title="Live Feature Snapshot">
        <div className="grid gap-2 md:grid-cols-3">
          {liveFeatures.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">
              <p className="text-slate-300">{k}</p>
              <p className="mono-data text-xl">{v}</p>
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
