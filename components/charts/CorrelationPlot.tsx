"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

const points = Array.from({ length: 24 }, (_, i) => {
  const bpm = 62 + i * 1.2 + Math.random() * 6;
  const hrv = 12 + bpm * 0.35 + Math.random() * 8;
  return { bpm: Number(bpm.toFixed(1)), hrv: Number(hrv.toFixed(1)) };
});

export function CorrelationPlot() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-64 w-full rounded bg-[#031424]" />;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <ScatterChart>
          <CartesianGrid stroke="#0d4f8c33" />
          <XAxis dataKey="bpm" name="BPM" stroke="#7fa4bf" />
          <YAxis dataKey="hrv" name="HRV" stroke="#7fa4bf" />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "#041a2e", border: "1px solid #0d4f8c" }} />
          <Scatter data={points} fill="#00d4ff" />
          <Line type="linear" dataKey="hrv" data={points} stroke="#ff2244" dot={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
