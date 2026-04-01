import { fail, ok, requireUser } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { DeviceModel } from "@/lib/server/models";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const { id } = await ctx.params;

  const device = await DeviceModel.findOne({ _id: id, userId: auth.sub });
  if (!device) return fail("Device not found", 404);

  const heartbeatMs = device.heartbeatAt ? Date.now() - new Date(device.heartbeatAt).getTime() : Number.MAX_SAFE_INTEGER;
  const connected = Boolean(device.isActive && device.sensorConnected && heartbeatMs <= 12_000);

  return ok({
    connected,
    sensor_connected: Boolean(device.sensorConnected),
    heartbeat_age_ms: heartbeatMs,
    last_seen: device.lastSeen,
    signal_strength: Number(device.signalStrength ?? 0),
    battery: Number(device.battery ?? 0),
  });
}
