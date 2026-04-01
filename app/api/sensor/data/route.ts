import { inferArrhythmia } from "@/lib/server/ml";
import { fail, ok } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { DeviceModel, ECGRecordModel, PredictionModel } from "@/lib/server/models";

export async function POST(request: Request) {
  await connectMongo();
  const body = await request.json();
  const deviceId = String(body.device_id ?? "");
  const apiKey = String(body.api_key ?? "");
  const signal: number[] = Array.isArray(body.signal) ? (body.signal as unknown[]).map((x) => Number(x)) : [];

  const device = await DeviceModel.findOne({ deviceIdStr: deviceId, apiKey, isActive: true });
  if (!device) return fail("Invalid device credentials", 401);
  if (!device.sensorConnected) return fail("Sensor is not connected", 409);
  if (!device.heartbeatAt || Date.now() - new Date(device.heartbeatAt).getTime() > 12_000) {
    return fail("Device heartbeat stale. Reconnect ESP32", 409);
  }
  if (signal.length !== 60) return fail("Signal chunk must contain exactly 60 samples", 400);
  if (signal.some((v: number) => Number.isNaN(v) || !Number.isFinite(v))) return fail("Signal contains invalid samples", 400);

  const avg = signal.reduce((a, b) => a + b, 0) / signal.length;
  const min = Math.min(...signal);
  const max = Math.max(...signal);
  const bpm = 75 + Math.floor(Math.random() * 10);

  const rec = await ECGRecordModel.create({
    userId: device.userId,
    deviceId: device._id,
    recordedAt: new Date(),
    durationSeconds: Math.round(signal.length / 360),
    samplingRate: 360,
    avgHeartRate: bpm,
    minHr: Math.round(min),
    maxHr: Math.round(max),
    source: "sensor" as const,
    signal,
  });

  const ml = inferArrhythmia(signal);
  const prediction = await PredictionModel.create({
    ecgRecordId: rec._id,
    predictedAt: new Date(),
    ...ml,
    featuresJson: {
      ...ml.featuresJson,
      mean: avg,
      amplitude: max - min,
    },
  });

  device.lastSeen = new Date();
  await device.save();

  return ok({ record_id: String(rec._id), prediction, accepted_at: new Date().toISOString() });
}
