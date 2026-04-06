"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

type CorrelationPoint = {
  x: number;
  y: number;
};

const defaultPoints: CorrelationPoint[] = Array.from({ length: 24 }, (_, i) => {
  const bpm = 62 + i * 1.2 + Math.random() * 6;
  const hrv = 12 + bpm * 0.35 + Math.random() * 8;
  return { x: Number(bpm.toFixed(1)), y: Number(hrv.toFixed(1)) };
});

export function CorrelationPlot({ data }: { data?: CorrelationPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-64 w-full rounded bg-[#031424]" />;

  const chartData = data && data.length ? data : defaultPoints;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <ScatterChart>
          <CartesianGrid stroke="#0d4f8c33" />
          <XAxis dataKey="x" name="BPM proxy" stroke="#7fa4bf" />
          <YAxis dataKey="y" name="Variability" stroke="#7fa4bf" />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "#041a2e", border: "1px solid #0d4f8c" }} />
          <Scatter data={chartData} fill="#00d4ff" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
