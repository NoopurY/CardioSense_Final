"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = Array.from({ length: 12 }, (_, i) => {
  const x = i + 1;
  const y = 0.56 * x + 72 + (Math.random() - 0.5) * 2.5;
  return { x, y: Number(y.toFixed(1)), fit: Number((0.56 * x + 72).toFixed(1)), fit2: Number((0.03 * x * x + 0.22 * x + 70).toFixed(1)) };
});

export function RegressionPlot() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-56 w-full rounded bg-[#031424]" />;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis dataKey="x" stroke="#7fa4bf" />
          <YAxis stroke="#7fa4bf" />
          <Tooltip contentStyle={{ background: "#041a2e", border: "1px solid #0d4f8c" }} />
          <Line dataKey="y" stroke="#00d4ff" strokeWidth={2} dot />
          <Line dataKey="fit" stroke="#ffcc00" dot={false} />
          <Line dataKey="fit2" stroke="#ff2244" dot={false} strokeDasharray="4 4" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
