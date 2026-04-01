import { randomUUID } from "node:crypto";
import { fail, ok, requireUser } from "@/lib/server/http";
import { sanitizeText } from "@/lib/server/sanitize";
import { connectMongo } from "@/lib/server/mongodb";
import { DeviceModel } from "@/lib/server/models";

export async function GET() {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const devices = await DeviceModel.find({ userId: auth.sub }).sort({ createdAt: -1 }).lean();
  return ok(devices);
}

export async function POST(request: Request) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const body = await request.json();

  const device = await DeviceModel.create({
    userId: auth.sub,
    deviceIdStr: sanitizeText(body.device_id_str),
    name: sanitizeText(body.name),
    location: sanitizeText(body.location),
    firmwareVersion: "1.0.0",
    lastSeen: new Date(),
    isActive: true,
    apiKey: randomUUID(),
    sensorConnected: false,
    heartbeatAt: null,
    samplingRate: 360,
  });

  return ok(device, { status: 201 });
}
