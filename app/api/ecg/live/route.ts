import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { DeviceModel, ECGRecordModel } from "@/lib/server/models";

export async function GET(request: Request) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);

  const url = new URL(request.url);
  const afterTsRaw = Number(url.searchParams.get("after_ts") ?? "0");
  const afterTs = Number.isFinite(afterTsRaw) && afterTsRaw > 0 ? afterTsRaw : 0;

  const activeDevice = await DeviceModel.findOne({ userId: auth.sub, isActive: true })
    .sort({ updatedAt: -1 })
    .select({ _id: 1 })
    .lean();

  if (!activeDevice?._id) {
    return ok({ chunks: [], latest_ts: afterTs });
  }

  const query: Record<string, unknown> = {
    userId: auth.sub,
    deviceId: activeDevice._id,
    source: "sensor",
  };
  if (afterTs > 0) {
    query.recordedAt = { $gt: new Date(afterTs) };
  }

  const rows = await ECGRecordModel.find(query)
    .sort({ recordedAt: 1 })
    .limit(24)
    .select({ signal: 1, avgHeartRate: 1, recordedAt: 1 })
    .lean();

  const chunks = rows.map((r: any) => ({
    id: String(r._id),
    ts: r.recordedAt ? new Date(r.recordedAt).getTime() : Date.now(),
    bpm: Number(r.avgHeartRate ?? 0),
    signal: Array.isArray(r.signal) ? r.signal.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n)) : [],
  }));

  const latestTs = chunks.length ? chunks[chunks.length - 1].ts : afterTs;
  return ok({ chunks, latest_ts: latestTs });
}