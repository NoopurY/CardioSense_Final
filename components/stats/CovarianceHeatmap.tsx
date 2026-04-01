const matrix = [
  [1, 0.42, -0.18, 0.11, 0.37],
  [0.42, 1, -0.21, 0.3, 0.46],
  [-0.18, -0.21, 1, -0.09, -0.05],
  [0.11, 0.3, -0.09, 1, 0.24],
  [0.37, 0.46, -0.05, 0.24, 1],
];

function color(v: number) {
  if (v > 0) return `rgba(0, 212, 255, ${0.2 + v * 0.6})`;
  return `rgba(255, 34, 68, ${0.2 + Math.abs(v) * 0.6})`;
}

export function CovarianceHeatmap() {
  return (
    <div className="grid grid-cols-5 gap-1">
      {matrix.flatMap((row, i) =>
        row.map((v, j) => (
          <div key={`${i}-${j}`} className="grid h-12 place-items-center rounded text-xs" style={{ background: color(v) }}>
            {v.toFixed(2)}
          </div>
        )),
      )}
    </div>
  );
}
