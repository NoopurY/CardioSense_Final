"use client";

import { useMemo, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from "recharts";

type RRPoint = { beat: number; rr: number };

type RRIntervalChartProps = {
  rrIntervals: number[]; // RR intervals in milliseconds
};

function rrColor(ms: number): string {
  if (ms < 500) return "#ff2244"; // tachycardia (<120 bpm)
  if (ms > 1200) return "#ffcc00"; // bradycardia (<50 bpm)
  return "#00d4ff"; // normal
}

export function RRIntervalChart({ rrIntervals }: RRIntervalChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data: RRPoint[] = useMemo(
    () => rrIntervals.slice(0, 80).map((rr, i) => ({ beat: i + 1, rr: Math.round(rr) })),
    [rrIntervals],
  );

  if (!mounted) {
    return <div className="h-56 w-full rounded-xl border border-cyan-500/25 bg-[#031424]" />;
  }

  if (!data.length) {
    return (
      <div className="grid h-56 w-full place-items-center rounded-xl border border-cyan-500/25 bg-[#031424] text-sm text-slate-400">
        Upload a CSV to see RR intervals
      </div>
    );
  }

  const minRR = Math.min(...data.map((d) => d.rr));
  const maxRR = Math.max(...data.map((d) => d.rr));
  const pad = Math.max(60, (maxRR - minRR) * 0.3);

  return (
    <div className="h-56 w-full ecg-grid rounded-xl border border-cyan-500/25 bg-[#031424] p-2">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="rgba(0,212,255,0.07)" />
          <XAxis
            dataKey="beat"
            type="number"
            name="Beat #"
            stroke="#7fa4bf"
            fontSize={10}
            label={{ value: "Beat #", position: "insideBottomRight", offset: -4, fill: "#7fa4bf", fontSize: 10 }}
          />
          <YAxis
            dataKey="rr"
            type="number"
            name="RR (ms)"
            stroke="#7fa4bf"
            fontSize={10}
            domain={[Math.max(200, minRR - pad), Math.min(1800, maxRR + pad)]}
            label={{ value: "ms", angle: -90, position: "insideLeft", fill: "#7fa4bf", fontSize: 10 }}
          />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as RRPoint;
              return (
                <div className="rounded border border-cyan-700 bg-[#031424] px-3 py-2 text-xs">
                  <p className="text-cyan-300">Beat #{d.beat}</p>
                  <p className="text-slate-200">RR: <span className="text-cyan-400 font-bold">{d.rr} ms</span></p>
                  <p className="text-slate-400">≈ {Math.round(60000 / d.rr)} bpm</p>
                </div>
              );
            }}
          />
          <ReferenceLine y={600} stroke="#ff2244" strokeDasharray="4 3" strokeOpacity={0.5} label={{ value: "120 bpm", fill: "#ff5566", fontSize: 9 }} />
          <ReferenceLine y={1000} stroke="#00ff88" strokeDasharray="4 3" strokeOpacity={0.4} label={{ value: "60 bpm", fill: "#00ff88", fontSize: 9 }} />
          <ReferenceLine y={1200} stroke="#ffcc00" strokeDasharray="4 3" strokeOpacity={0.5} label={{ value: "50 bpm", fill: "#ffcc00", fontSize: 9 }} />
          <Scatter data={data} shape="circle">
            {data.map((entry) => (
              <Cell key={entry.beat} fill={rrColor(entry.rr)} fillOpacity={0.85} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
