import { randomUUID } from "node:crypto";
import { fail, ok } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { DeviceModel, UserModel } from "@/lib/server/models";

export async function POST(request: Request) {
  await connectMongo();
  const body = await request.json();
  const deviceId = String(body.device_id ?? "");
  const apiKey = String(body.api_key ?? "");
  const enrollmentKey = String(body.enrollment_key ?? "");
  const sensorConnected = Boolean(body.sensor_connected ?? false);
  const samplingRate = Number(body.sampling_rate ?? 360);
  const signalStrength = Number(body.signal_strength ?? 0);
  const battery = Number(body.battery ?? 0);

  if (!deviceId) return fail("Missing device_id", 400);

  let device: any = null;
  let provisioned = false;

  if (apiKey) {
    device = await DeviceModel.findOne({ deviceIdStr: deviceId, apiKey, isActive: true });
  } else {
    const expectedEnrollmentKey = process.env.DEVICE_ENROLLMENT_KEY;
    const provisionEmail = process.env.AUTO_PROVISION_USER_EMAIL?.trim().toLowerCase();

    if (!enrollmentKey) return fail("Missing api_key or enrollment_key", 400);
    if (!expectedEnrollmentKey || enrollmentKey !== expectedEnrollmentKey) {
      return fail("Invalid enrollment key", 401);
    }
    if (!provisionEmail) {
      return fail("AUTO_PROVISION_USER_EMAIL is not configured", 500);
    }

    const user = await UserModel.findOne({ email: provisionEmail, isActive: true });
    if (!user) return fail("Auto-provision user not found", 404);

    device = await DeviceModel.findOne({ deviceIdStr: deviceId });
    if (!device) {
      device = await DeviceModel.create({
        userId: user._id,
        deviceIdStr: deviceId,
        name: deviceId,
        firmwareVersion: "auto-provisioned",
        isActive: true,
        apiKey: randomUUID(),
        sensorConnected: false,
        samplingRate: 360,
      });
      provisioned = true;
    } else if (String(device.userId) !== String(user._id)) {
      return fail("Device is already claimed by a different user", 403);
    }
  }

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
    api_key: String(device.apiKey),
    provisioned,
  });
}
