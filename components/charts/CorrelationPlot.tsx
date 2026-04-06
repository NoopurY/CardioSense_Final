"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

type CorrelationPoint = {
  x: number;
  y: number;
};

export function CorrelationPlot({ data }: { data: CorrelationPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-64 w-full rounded bg-[#031424]" />;
  if (!data.length) return <p className="pt-24 text-center text-sm text-slate-400">Upload CSV and run analysis to see this chart.</p>;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <ScatterChart>
          <CartesianGrid stroke="#0d4f8c33" />
          <XAxis dataKey="x" name="BPM proxy" stroke="#7fa4bf" />
          <YAxis dataKey="y" name="Variability" stroke="#7fa4bf" />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "#041a2e", border: "1px solid #0d4f8c" }} />
          <Scatter data={data} fill="#00d4ff" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
