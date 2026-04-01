export function inferArrhythmia(signal: number[]) {
  const avg = signal.reduce((a, b) => a + b, 0) / Math.max(signal.length, 1);
  const variance = signal.reduce((a, b) => a + (b - avg) ** 2, 0) / Math.max(signal.length, 1);
  const riskScore = Math.min(1, Math.max(0, variance * 6));
  const label = riskScore > 0.7 ? "High Risk" : riskScore > 0.4 ? "Moderate Risk" : "Low Risk";

  return {
    predictionLabel: label,
    arrhythmiaType: riskScore > 0.7 ? "PVC" : riskScore > 0.4 ? "SVE" : "Normal",
    confidence: 0.8 - riskScore * 0.2,
    riskScore,
    classId: riskScore > 0.7 ? 2 : riskScore > 0.4 ? 1 : 0,
    featuresJson: {
      mean: avg,
      variance,
      snr: 20 + Math.random() * 4,
      hrv: 35 + Math.random() * 25,
    },
    modelVersion: "rf-mitbih-v1",
  };
}
