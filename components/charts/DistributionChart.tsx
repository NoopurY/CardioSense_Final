"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const normalData = Array.from({ length: 17 }, (_, i) => {
  const x = 50 + i * 3;
  const mu = 79;
  const sigma = 8;
  const y = Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2));
  return { bpm: x, p: Number(y.toFixed(4)) };
});

const poissonData = Array.from({ length: 8 }, (_, k) => {
  const lambda = 2.2;
  const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
  const p = (Math.exp(-lambda) * lambda ** k) / fact(k);
  return { k, p: Number(p.toFixed(3)) };
});

type PoissonPoint = {
  k: number;
  p: number;
};

export function NormalDistributionChart() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-56 w-full rounded bg-[#031424]" />;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <AreaChart data={normalData}>
          <CartesianGrid stroke="#0d4f8c33" />
          <XAxis dataKey="bpm" stroke="#7fa4bf" />
          <YAxis stroke="#7fa4bf" />
          <Tooltip contentStyle={{ background: "#041a2e", border: "1px solid #0d4f8c" }} />
          <Area type="monotone" dataKey="p" stroke="#00d4ff" fill="#00d4ff22" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PoissonChart({ data }: { data?: PoissonPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-56 w-full rounded bg-[#031424]" />;

  const chartData = data && data.length > 0 ? data : poissonData;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={chartData}>
          <CartesianGrid stroke="#0d4f8c33" />
          <XAxis dataKey="k" stroke="#7fa4bf" />
          <YAxis stroke="#7fa4bf" />
          <Tooltip contentStyle={{ background: "#041a2e", border: "1px solid #0d4f8c" }} />
          <Bar dataKey="p" fill="#00d4ff" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
