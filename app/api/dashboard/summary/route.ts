import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { DeviceModel, ECGRecordModel, PredictionModel } from "@/lib/server/models";

export async function GET() {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);

  const records = await ECGRecordModel.find({ userId: auth.sub }).lean();
  const recordIds = records.map((r) => r._id);
  const predictions = await PredictionModel.find({ ecgRecordId: { $in: recordIds } }).lean();
  const devices = await DeviceModel.find({ userId: auth.sub, isActive: true }).lean();

  const avgBpm = records.reduce((s, r) => s + (r.avgHeartRate ?? 0), 0) / Math.max(1, records.length);
  return ok({
    total_recordings: records.length,
    avg_bpm: Number(avgBpm.toFixed(1)),
    arrhythmia_count: predictions.filter((p) => p.arrhythmiaType !== "Normal").length,
    device_online: devices.some((d) => d.sensorConnected && d.heartbeatAt && Date.now() - new Date(d.heartbeatAt).getTime() <= 12000),
  });
}
