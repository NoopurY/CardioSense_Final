import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { hashPassword, signToken } from "@/lib/server/auth";
import { ok, fail } from "@/lib/server/http";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { sanitizeText } from "@/lib/server/sanitize";
import { connectMongo } from "@/lib/server/mongodb";
import { UserModel, DeviceModel } from "@/lib/server/models";

export async function POST(request: Request) {
  await connectMongo();
  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`signup:${ip}`)) return fail("Too many attempts", 429);

  const body = await request.json();

  // Required fields
  const email = sanitizeText(body.email ?? "").toLowerCase();
  const password = sanitizeText(body.password ?? "");
  const name = sanitizeText(body.name ?? "");

  if (!email || !password || !name) return fail("Name, email, and password are required.");
  if (password.length < 8) return fail("Password must be at least 8 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Invalid email address.");

  const existing = await UserModel.findOne({ email }).lean();
  if (existing) return fail("An account with this email already exists.", 409);

  // Optional profile fields
  const dob = sanitizeText(body.dob ?? "");
  const gender = sanitizeText(body.gender ?? "");
  const bloodGroup = sanitizeText(body.bloodGroup ?? "");

  const user = await UserModel.create({
    email,
    passwordHash: await hashPassword(password),
    name,
    dob: dob || undefined,
    gender: gender || undefined,
    bloodGroup: bloodGroup || undefined,
    isActive: true,
    isAdmin: false,
    provider: "credentials",
    providerAccountId: randomUUID(),
  });

  // Optionally register a device
  const deviceIdStr = sanitizeText(body.deviceId ?? "");
  const sensorType = sanitizeText(body.sensorType ?? "");
  if (deviceIdStr) {
    try {
      await DeviceModel.create({
        userId: user._id,
        deviceIdStr,
        name: deviceIdStr,
        firmwareVersion: sensorType || undefined,
        isActive: true,
        apiKey: randomUUID(),
        sensorConnected: false,
      });
    } catch {
      // Device creation is optional — don't fail the whole signup
    }
  }

  const token = await signToken({ sub: String(user._id), email: user.email });
  (await cookies()).set("access_token", token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 30, // 30 minutes
  });

  return ok(
    { user: { id: String(user._id), email: user.email, name: user.name } },
    { status: 201 }
  );
}
