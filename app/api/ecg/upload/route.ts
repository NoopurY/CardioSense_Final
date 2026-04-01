import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { DeviceModel, ECGRecordModel } from "@/lib/server/models";

export async function POST(request: Request) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const body = await request.json();
  const signal: number[] = Array.isArray(body.signal) ? (body.signal as unknown[]).map((x) => Number(x)) : [];

  const device = await DeviceModel.findOne({ userId: auth.sub, isActive: true }).sort({ updatedAt: -1 });
  if (!device) return fail("No device found", 404);

  const rec = await ECGRecordModel.create({
    userId: auth.sub,
    deviceId: device._id,
    recordedAt: new Date(),
    durationSeconds: Number(body.duration_seconds ?? 30),
    samplingRate: Number(body.sampling_rate ?? 360),
    avgHeartRate: Number(body.avg_heart_rate ?? 80),
    minHr: Number(body.min_hr ?? 70),
    maxHr: Number(body.max_hr ?? 95),
    source: "upload" as const,
    signal,
  });

  return ok(rec, { status: 201 });
}
