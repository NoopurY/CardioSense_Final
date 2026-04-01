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

const conceptExplainers = [
  {
    title: "Normal Distribution",
    explanation:
      "Shows how heart-rate values spread around an average. If most points stay near the center and fewer appear at the edges, your readings are stable.",
    whyItMatters:
      "Helps you quickly spot unusual heart-rate readings that are far from your normal range.",
  },
  {
    title: "Poisson Distribution",
    explanation:
      "Estimates how often a rare event happens in a fixed time window, such as arrhythmia events per hour.",
    whyItMatters:
      "Useful for answering: 'How many episodes should I expect in the next hour or day?'",
  },
  {
    title: "Bayes Theorem",
    explanation:
      "Updates risk confidence when new ECG evidence arrives. It combines prior risk with current signal quality and pattern likelihood.",
    whyItMatters:
      "Gives a more realistic probability instead of a fixed yes/no result.",
  },
  {
    title: "T-Distribution and Confidence Interval",
    explanation:
      "Used when sample size is limited. It builds a range where the true average BPM is likely to lie.",
    whyItMatters:
      "Shows uncertainty clearly, so decisions are based on a range, not just one number.",
  },
  {
    title: "Pearson Correlation",
    explanation:
      "Measures how strongly two variables move together in a straight-line pattern. Values are between -1 and +1.",
    whyItMatters:
      "Helps detect whether one signal tends to rise or fall when another changes.",
  },
  {
    title: "Regression",
    explanation:
      "Fits a line or curve to past data so you can estimate trends and expected future behavior.",
    whyItMatters:
      "Useful for trend prediction, such as gradual BPM rise under specific conditions.",
  },
  {
    title: "Spearman Rank Correlation",
    explanation:
      "Checks whether rankings move together, even if the relationship is not perfectly linear.",
    whyItMatters:
      "Good for noisy biological data where exact values vary but overall order still carries meaning.",
  },
  {
    title: "Covariance Matrix",
    explanation:
      "A table showing how each pair of features changes together, such as BPM, HRV, and confidence scores.",
    whyItMatters:
      "Helps identify feature relationships that can improve model quality and interpretation.",
  },
];

const valueInterpretationGuide = [
  "Correlation (r or R): near +1 means strong positive relation, near 0 means weak/no clear relation, near -1 means strong inverse relation.",
  "Lambda (λ): expected number of events per fixed time window. Example: λ = 2.2 means around 2 to 3 events per hour on average.",
  "Mean (μ): your central or typical value. Standard deviation (σ): how spread out readings are around that mean.",
  "95% CI [a, b]: likely range of the true average. Narrower interval means higher precision; wider interval means more uncertainty.",
  "Regression slope: positive slope means output increases as input increases. Larger absolute slope means faster change.",
  "Covariance sign: positive means variables move together; negative means they move in opposite directions; near zero means weak linear co-movement.",
];

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
    <div className="space-y-4">
      <Panel title="Beginner Concept Guide" subtitle="Simple meaning of each statistical method used below">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {conceptExplainers.map((item) => (
            <div key={item.title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <h3 className="text-sm font-semibold text-cyan-200">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">{item.explanation}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-200">
                <span className="font-semibold text-cyan-300">Why it matters: </span>
                {item.whyItMatters}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Value Interpretation Guide" subtitle="How to read the numbers shown in these charts">
        <ul className="grid gap-2 text-xs text-slate-300 md:grid-cols-2">
          {valueInterpretationGuide.map((item) => (
            <li key={item} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Normal Distribution" subtitle="Heart-rate histogram with bell curve">
        <NormalDistributionChart />
        <p className="text-xs text-slate-300">68-95-99.7 rule around μ = 79 and σ = 8</p>
        <p className="mt-1 text-xs text-cyan-200">Interpretation: Most readings are centered near 79 BPM, and typical variation is about ±8 BPM.</p>
      </Panel>
      <Panel title="Poisson Distribution" subtitle="Arrhythmia events per hour">
        <PoissonChart />
        <p className="text-xs text-slate-300">λ = 2.2 events/hour</p>
        <p className="mt-1 text-xs text-cyan-200">Interpretation: You can expect about 2 to 3 arrhythmia events per hour on average.</p>
      </Panel>
      <Panel title="Bayes Theorem" subtitle="AI confidence calculator">
        <BayesWidget />
        <p className="text-xs text-cyan-200">Interpretation: Higher posterior probability means stronger evidence for risk after combining prior history and new signal data.</p>
      </Panel>
      <Panel title="T-Distribution + CI" subtitle="95% mean BPM interval">
        <div className="space-y-2 text-sm text-slate-300">
          <p>Degrees of freedom: <span className="mono-data">29</span></p>
          <p>t-critical: <span className="mono-data">2.045</span></p>
          <p>95% CI: <span className="mono-data">[76.4, 82.1]</span></p>
          <p className="text-xs">Formula: CI = x̄ ± t*(s/√n)</p>
          <p className="text-xs text-cyan-200">Interpretation: The true average BPM is likely between 76.4 and 82.1, and this interval reflects uncertainty from limited samples.</p>
        </div>
      </Panel>
      <Panel title="Karl Pearson Correlation (r)">
        <CorrelationPlot />
        <p className="text-xs text-slate-300">r = 0.73 (moderate to strong positive)</p>
        <p className="mt-1 text-xs text-cyan-200">Interpretation: As one variable increases, the other usually increases too, with fairly strong consistency.</p>
      </Panel>
      <Panel title="Regression (1st and 2nd Degree)">
        <RegressionPlot />
        <p className="text-xs text-slate-300">y = 0.56x + 72 and y = 0.03x² + 0.22x + 70</p>
        <p className="mt-1 text-xs text-cyan-200">Interpretation: Positive coefficients indicate an upward trend; the quadratic model captures curvature when linear fit is not enough.</p>
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
        <p className="mt-1 text-xs text-cyan-200">Interpretation: R closer to +1 means rankings are very similar; closer to 0 means weak monotonic relationship.</p>
      </Panel>
      <Panel title="Covariance Matrix">
        <CovarianceHeatmap />
        <p className="text-xs text-cyan-200">Interpretation: Positive cells mean features move together, negative cells mean opposite movement, and larger magnitude means stronger co-variation.</p>
      </Panel>
      </div>
    </div>
  );
}
