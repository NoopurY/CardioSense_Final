"use client";

import { useMemo, useState } from "react";

export function BayesWidget() {
  const [prior, setPrior] = useState(0.12);
  const [likelihood, setLikelihood] = useState(0.82);
  const [evidence, setEvidence] = useState(0.27);

  const posterior = useMemo(() => {
    const p = (prior * likelihood) / Math.max(evidence, 0.001);
    return Math.max(0, Math.min(1, p));
  }, [prior, likelihood, evidence]);

  return (
    <div className="space-y-3 text-sm">
      <label className="grid gap-1">
        Prior P(A): <span className="mono-data">{prior.toFixed(2)}</span>
        <input type="range" min={0.01} max={0.9} step={0.01} value={prior} onChange={(e) => setPrior(Number(e.target.value))} />
      </label>
      <label className="grid gap-1">
        Likelihood P(B|A): <span className="mono-data">{likelihood.toFixed(2)}</span>
        <input
          type="range"
          min={0.01}
          max={0.99}
          step={0.01}
          value={likelihood}
          onChange={(e) => setLikelihood(Number(e.target.value))}
        />
      </label>
      <label className="grid gap-1">
        Evidence P(B): <span className="mono-data">{evidence.toFixed(2)}</span>
        <input
          type="range"
          min={0.01}
          max={0.99}
          step={0.01}
          value={evidence}
          onChange={(e) => setEvidence(Number(e.target.value))}
        />
      </label>
      <p className="text-cyan-300">
        Posterior P(A|B) = (P(B|A) * P(A)) / P(B) = <span className="mono-data text-2xl">{posterior.toFixed(3)}</span>
      </p>
    </div>
  );
}
