"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const weekly = [
  { day: "Mon", bpm: 78, hrv: 42 },
  { day: "Tue", bpm: 84, hrv: 36 },
  { day: "Wed", bpm: 81, hrv: 38 },
  { day: "Thu", bpm: 86, hrv: 32 },
  { day: "Fri", bpm: 80, hrv: 44 },
  { day: "Sat", bpm: 76, hrv: 49 },
  { day: "Sun", bpm: 79, hrv: 45 },
];

export function HeartRateTrend() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-40 w-full rounded bg-[#031424]" />;

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer>
        <LineChart data={weekly}>
          <XAxis dataKey="day" stroke="#7fa4bf" fontSize={11} />
          <YAxis stroke="#7fa4bf" fontSize={11} />
          <Tooltip contentStyle={{ background: "#041a2e", border: "1px solid #0d4f8c" }} />
          <Line type="monotone" dataKey="bpm" stroke="#00d4ff" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HRVBarChart() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-40 w-full rounded bg-[#031424]" />;

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer>
        <BarChart data={weekly}>
          <XAxis dataKey="day" stroke="#7fa4bf" fontSize={11} />
          <YAxis stroke="#7fa4bf" fontSize={11} />
          <Tooltip contentStyle={{ background: "#041a2e", border: "1px solid #0d4f8c" }} />
          <Bar dataKey="hrv" fill="#00d4ff" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
