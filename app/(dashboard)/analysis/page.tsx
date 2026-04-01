"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { LiveECGChart } from "@/components/charts/LiveECGChart";
import { NormalDistributionChart, PoissonChart } from "@/components/charts/DistributionChart";
import { CorrelationPlot } from "@/components/charts/CorrelationPlot";
import { RegressionPlot } from "@/components/stats/RegressionPlot";
import { BayesWidget } from "@/components/stats/BayesWidget";

export default function AnalysisPage() {
  const [signal, setSignal] = useState<number[]>([]);
  const [analyzed, setAnalyzed] = useState(false);

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
    setAnalyzed(false);
  };

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
            <Button variant="ghost" onClick={() => setAnalyzed(true)}>
              Run AI Analysis
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Waveform Viewer" subtitle="Zoomable ECG with R-peaks">
        <LiveECGChart points={signal} />
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Signal Quality">
          <p className="text-sm text-slate-300">SNR: <span className="mono-data">22.4 dB</span></p>
          <p className="text-sm text-slate-300">Baseline Wander: <span className="mono-data">Low</span></p>
          <p className="text-sm text-slate-300">Noise Level: <span className="mono-data">0.12</span></p>
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
