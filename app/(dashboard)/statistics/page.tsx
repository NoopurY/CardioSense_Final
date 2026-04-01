"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { NormalDistributionChart, PoissonChart } from "@/components/charts/DistributionChart";
import { CorrelationPlot } from "@/components/charts/CorrelationPlot";
import { BayesWidget } from "@/components/stats/BayesWidget";
import { RegressionPlot } from "@/components/stats/RegressionPlot";
import { CovarianceHeatmap } from "@/components/stats/CovarianceHeatmap";
import { api } from "@/lib/api";

type Summary = {
  total_recordings: number;
};

export default function StatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get("/api/dashboard/summary")
      .then((res) => setSummary(res.data ?? null))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Panel title="Statistics">
        <p className="text-sm text-slate-400">Loading statistics...</p>
      </Panel>
    );
  }

  if (!summary || summary.total_recordings === 0) {
    return (
      <Panel title="Statistics" subtitle="No data yet">
        <p className="text-sm text-slate-300">
          No ECG records available for this account yet. Connect your ESP32 and send ECG data to unlock statistics.
        </p>
      </Panel>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Normal Distribution" subtitle="Heart-rate histogram with bell curve">
        <NormalDistributionChart />
        <p className="text-xs text-slate-300">68-95-99.7 rule around μ = 79 and σ = 8</p>
      </Panel>
      <Panel title="Poisson Distribution" subtitle="Arrhythmia events per hour">
        <PoissonChart />
        <p className="text-xs text-slate-300">λ = 2.2 events/hour</p>
      </Panel>
      <Panel title="Bayes Theorem" subtitle="AI confidence calculator">
        <BayesWidget />
      </Panel>
      <Panel title="T-Distribution + CI" subtitle="95% mean BPM interval">
        <div className="space-y-2 text-sm text-slate-300">
          <p>Degrees of freedom: <span className="mono-data">29</span></p>
          <p>t-critical: <span className="mono-data">2.045</span></p>
          <p>95% CI: <span className="mono-data">[76.4, 82.1]</span></p>
          <p className="text-xs">Formula: CI = x̄ ± t*(s/√n)</p>
        </div>
      </Panel>
      <Panel title="Karl Pearson Correlation (r)">
        <CorrelationPlot />
        <p className="text-xs text-slate-300">r = 0.73 (moderate to strong positive)</p>
      </Panel>
      <Panel title="Regression (1st and 2nd Degree)">
        <RegressionPlot />
        <p className="text-xs text-slate-300">y = 0.56x + 72 and y = 0.03x² + 0.22x + 70</p>
      </Panel>
      <Panel title="Spearman Rank R" subtitle="Ranked variables and differences">
        <table className="w-full text-xs text-slate-300">
          <thead>
            <tr>
              <th className="text-left">Sample</th>
              <th>Rank BPM</th>
              <th>Rank HRV</th>
              <th>d²</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="border-t border-slate-800">
                <td>S{i}</td>
                <td className="text-center">{i}</td>
                <td className="text-center">{i + (i % 2 ? 1 : -1)}</td>
                <td className="text-center">1</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-300">R = 1 - (6 Σd²) / n(n² - 1)</p>
      </Panel>
      <Panel title="Covariance Matrix">
        <CovarianceHeatmap />
      </Panel>
    </div>
  );
}
