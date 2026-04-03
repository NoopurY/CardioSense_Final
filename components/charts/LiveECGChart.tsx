"use client";

import { useMemo } from "react";
import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type LiveECGChartProps = {
  points?: number[];
};

export function LiveECGChart({ points }: LiveECGChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const hasData = Boolean(points && points.length > 10);

  const data = useMemo(() => {
    const src = hasData ? points!.slice(-220) : [];
    return src.map((v, i) => ({ x: i, y: Number(v.toFixed(3)) }));
  }, [hasData, points]);

  const yDomain = useMemo(() => {
    if (!data.length) return [-1.2, 1.2] as [number, number];

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const p of data) {
      if (p.y < min) min = p.y;
      if (p.y > max) max = p.y;
    }

    const span = Math.max(0.24, max - min);
    const pad = span * 0.35;
    return [min - pad, max + pad] as [number, number];
  }, [data]);

  if (!mounted) {
    return <div className="h-64 w-full rounded-xl border border-cyan-500/25 bg-[#031424]" />;
  }

  if (!hasData) {
    return (
      <div className="grid h-64 w-full place-items-center rounded-xl border border-cyan-500/25 bg-[#031424] p-2 ecg-grid text-sm text-slate-400">
        Waiting for ECG stream from ESP32...
      </div>
    );
  }

  return (
    <div className="h-64 w-full rounded-xl border border-cyan-500/25 bg-[#031424] p-2 ecg-grid">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis hide dataKey="x" />
          <YAxis hide domain={yDomain} />
          <Tooltip contentStyle={{ background: "#031424", border: "1px solid #0d4f8c" }} />
          <Line type="monotone" dataKey="y" stroke="#00d4ff" strokeWidth={2} dot={false} isAnimationActive />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
