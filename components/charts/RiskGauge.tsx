type RiskGaugeProps = {
  value: number;
};

export function RiskGauge({ value }: RiskGaugeProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const color = pct > 70 ? "#ff2244" : pct > 45 ? "#ffcc00" : "#00ff88";

  return (
    <div className="grid place-items-center gap-2">
      <div
        className="grid h-36 w-36 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(13,79,140,0.25) 0deg)`,
        }}
      >
        <div className="grid h-28 w-28 place-items-center rounded-full border border-cyan-600/40 bg-[#03182d]">
          <span className="glow-text text-3xl">{pct}%</span>
        </div>
      </div>
      <p className="text-xs text-slate-300">Risk Score</p>
    </div>
  );
}
