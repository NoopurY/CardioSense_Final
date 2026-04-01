import { fail, ok } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { DeviceModel } from "@/lib/server/models";

export async function POST(request: Request) {
  await connectMongo();
  const body = await request.json();
  const deviceId = String(body.device_id ?? "");
  const apiKey = String(body.api_key ?? "");
  const sensorConnected = Boolean(body.sensor_connected ?? false);
  const samplingRate = Number(body.sampling_rate ?? 360);
  const signalStrength = Number(body.signal_strength ?? 0);
  const battery = Number(body.battery ?? 0);

  if (!deviceId || !apiKey) return fail("Missing device credentials", 400);

  const device = await DeviceModel.findOne({ deviceIdStr: deviceId, apiKey, isActive: true });
  if (!device) return fail("Invalid device credentials", 401);

  device.heartbeatAt = new Date();
  device.lastSeen = new Date();
  device.sensorConnected = sensorConnected;
  device.samplingRate = samplingRate;
  device.signalStrength = Number.isFinite(signalStrength) ? Math.max(0, Math.min(100, Math.round(signalStrength))) : 0;
  device.battery = Number.isFinite(battery) ? Math.max(0, Math.min(100, Math.round(battery))) : 0;
  await device.save();

  return ok({
    accepted: true,
    connected: sensorConnected,
    signal_strength: device.signalStrength,
    battery: device.battery,
  });
}
