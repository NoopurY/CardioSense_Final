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

type HistoryItem = {
  _id: string;
  date: string | null;
  bpm: number;
  prediction: string;
  risk: "Low" | "Medium" | "High" | "Unknown";
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

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

function buildPoissonFromHistory(history: HistoryItem[]) {
  const withDates = history
    .map((h) => ({ ...h, ts: h.date ? new Date(h.date).getTime() : NaN }))
    .filter((h) => Number.isFinite(h.ts));

  if (withDates.length < 2) return null;

  const minTs = Math.min(...withDates.map((h) => h.ts));
  const maxTs = Math.max(...withDates.map((h) => h.ts));
  const observedHours = Math.max((maxTs - minTs) / 3_600_000, 1);

  const arrhythmiaCount = withDates.filter((h) => {
    const label = h.prediction.toLowerCase();
    return label !== "normal" && label !== "pending";
  }).length;

  const lambda = arrhythmiaCount / observedHours;
  const probabilities = Array.from({ length: 7 }, (_, k) => {
    const p = (Math.exp(-lambda) * lambda ** k) / factorial(k);
    return { k, p: Number(p.toFixed(3)) };
  });

  return {
    lambda: Number(lambda.toFixed(2)),
    probabilities,
  };
}

function rank(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length).fill(0);

  let pos = 0;
  while (pos < indexed.length) {
    let end = pos;
    while (end + 1 < indexed.length && indexed[end + 1].v === indexed[pos].v) end += 1;
    const avgRank = (pos + end + 2) / 2;
    for (let j = pos; j <= end; j += 1) ranks[indexed[j].i] = avgRank;
    pos = end + 1;
  }

  return ranks;
}

function riskToNumeric(risk: HistoryItem["risk"]): number {
  if (risk === "Low") return 1;
  if (risk === "Medium") return 2;
  if (risk === "High") return 3;
  return 0;
}

function buildSpearmanFromHistory(history: HistoryItem[]) {
  const points = history
    .map((h) => ({ bpm: h.bpm, riskScore: riskToNumeric(h.risk) }))
    .filter((h) => Number.isFinite(h.bpm) && h.bpm > 0 && h.riskScore > 0)
    .slice(0, 8);

  const n = points.length;
  if (n < 3) return null;

  const bpmRanks = rank(points.map((p) => p.bpm));
  const riskRanks = rank(points.map((p) => p.riskScore));

  const rows = points.map((_, idx) => {
    const d = bpmRanks[idx] - riskRanks[idx];
    return {
      sample: `S${idx + 1}`,
      rankBpm: bpmRanks[idx],
      rankRisk: riskRanks[idx],
      d2: Number((d * d).toFixed(2)),
    };
  });

  const sumD2 = rows.reduce((acc, row) => acc + row.d2, 0);
  const rho = 1 - (6 * sumD2) / (n * (n * n - 1));

  return {
    rows,
    rho: Number(rho.toFixed(3)),
  };
}

export default function StatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get("/api/dashboard/summary"), api.get("/api/ecg/history")])
      .then(([summaryRes, historyRes]) => {
        setSummary(summaryRes.data ?? null);
        setHistory(Array.isArray(historyRes.data?.data) ? (historyRes.data.data as HistoryItem[]) : []);
      })
      .catch(() => {
        setSummary(null);
        setHistory([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const poissonStats = buildPoissonFromHistory(history);
  const spearmanStats = buildSpearmanFromHistory(history);

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
        {poissonStats ? (
          <>
            <PoissonChart data={poissonStats.probabilities} />
            <p className="text-xs text-slate-300">λ = {poissonStats.lambda} events/hour (computed from your stored records)</p>
            <p className="mt-1 text-xs text-cyan-200">Interpretation: Based on your current history window, this is the expected event rate per hour.</p>
          </>
        ) : (
          <p className="text-sm text-slate-300">Not enough timestamped records yet to estimate event rate. Connect ESP32 and stream data first.</p>
        )}
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
        {spearmanStats ? (
          <>
            <table className="w-full text-xs text-slate-300">
              <thead>
                <tr>
                  <th className="text-left">Sample</th>
                  <th>Rank BPM</th>
                  <th>Rank Risk</th>
                  <th>d²</th>
                </tr>
              </thead>
              <tbody>
                {spearmanStats.rows.map((row) => (
                  <tr key={row.sample} className="border-t border-slate-800">
                    <td>{row.sample}</td>
                    <td className="text-center">{row.rankBpm.toFixed(1)}</td>
                    <td className="text-center">{row.rankRisk.toFixed(1)}</td>
                    <td className="text-center">{row.d2.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-300">R = {spearmanStats.rho} (from your stored records)</p>
            <p className="mt-1 text-xs text-cyan-200">Interpretation: R closer to +1 means rankings are very similar; closer to 0 means weak monotonic relationship.</p>
          </>
        ) : (
          <p className="text-sm text-slate-300">Not enough ranked records yet for Spearman analysis. Add more ECG captures from ESP32.</p>
        )}
      </Panel>
      <Panel title="Covariance Matrix">
        <CovarianceHeatmap />
        <p className="text-xs text-cyan-200">Interpretation: Positive cells mean features move together, negative cells mean opposite movement, and larger magnitude means stronger co-variation.</p>
      </Panel>
      </div>
    </div>
  );
}
