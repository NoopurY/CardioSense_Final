"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type TrendPoint = {
  day: string;
  bpm?: number;
  hrv?: number;
};

export function HeartRateTrend({ data = [] }: { data?: TrendPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-40 w-full rounded bg-[#031424]" />;
  if (!data.length) {
    return <p className="text-sm text-slate-400">No real trend data available yet.</p>;
  }

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis dataKey="day" stroke="#7fa4bf" fontSize={11} />
          <YAxis stroke="#7fa4bf" fontSize={11} />
          <Tooltip contentStyle={{ background: "#041a2e", border: "1px solid #0d4f8c" }} />
          <Line type="monotone" dataKey="bpm" stroke="#00d4ff" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HRVBarChart({ data = [] }: { data?: TrendPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-40 w-full rounded bg-[#031424]" />;
  if (!data.length) {
    return <p className="text-sm text-slate-400">No real HRV samples available yet.</p>;
  }

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis dataKey="day" stroke="#7fa4bf" fontSize={11} />
          <YAxis stroke="#7fa4bf" fontSize={11} />
          <Tooltip contentStyle={{ background: "#041a2e", border: "1px solid #0d4f8c" }} />
          <Bar dataKey="hrv" fill="#00d4ff" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
