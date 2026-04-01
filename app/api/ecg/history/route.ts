import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { ECGRecordModel, PredictionModel } from "@/lib/server/models";

function toRiskLabel(riskScore?: number | null) {
  if (riskScore == null) return "Unknown";
  if (riskScore >= 70) return "High";
  if (riskScore >= 40) return "Medium";
  return "Low";
}

export async function GET() {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const records = await ECGRecordModel.find({ userId: auth.sub }).sort({ recordedAt: -1 }).lean();
  if (!records.length) return ok({ data: [] });

  const recordIds = records.map((r) => r._id);
  const predictions: any[] = await PredictionModel.find({ ecgRecordId: { $in: recordIds } }).lean();
  const predictionByRecord = new Map(predictions.map((p) => [String(p.ecgRecordId), p]));

  const normalized = records.map((r: any) => {
    const prediction = predictionByRecord.get(String(r._id));
    return {
      _id: String(r._id),
      date: r.recordedAt ? new Date(r.recordedAt).toISOString() : null,
      duration: r.durationSeconds ?? 0,
      bpm: r.avgHeartRate ?? 0,
      prediction: prediction?.predictionLabel ?? prediction?.arrhythmiaType ?? "Pending",
      risk: toRiskLabel(prediction?.riskScore),
    };
  });

  return ok({ data: normalized });
}
