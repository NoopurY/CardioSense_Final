"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type NormalPoint = {
  x: number;
  p: number;
};

type PoissonPoint = {
  k: number;
  p: number;
};

export function NormalDistributionChart({ data }: { data: NormalPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-56 w-full rounded bg-[#031424]" />;
  if (!data.length) return <p className="pt-20 text-center text-sm text-slate-400">Upload CSV and run analysis to see this chart.</p>;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <CartesianGrid stroke="#0d4f8c33" />
          <XAxis dataKey="x" stroke="#7fa4bf" />
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
  if (!data || !data.length) return <p className="pt-20 text-center text-sm text-slate-400">Upload CSV and run analysis to see this chart.</p>;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
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
