import { randomUUID } from "node:crypto";
import type { Alert, Device, ECGRecord, Prediction, User } from "@/lib/server/types";

export const db = {
  users: [] as User[],
  devices: [] as Device[],
  ecgRecords: [] as ECGRecord[],
  predictions: [] as Prediction[],
  alerts: [] as Alert[],
  refreshTokens: new Map<string, string>(),
};

export function ensureSeed() {
  if (db.users.length > 0) return;
  const userId = randomUUID();
  const deviceId = randomUUID();

  db.users.push({
    id: userId,
    email: "demo@cardiosense.ai",
    passwordHash: "$2b$12$L4cwJ/xeKfZM7xPBtefLsOtGsxVd3l1vgWQh8k9u9Bvpr.3AnIVIm",
    name: "Demo User",
    createdAt: new Date().toISOString(),
    isActive: true,
    isAdmin: false,
  });

  db.devices.push({
    id: deviceId,
    userId,
    deviceIdStr: "ESP32_001",
    name: "Primary Chest Lead",
    location: "Home",
    firmwareVersion: "1.0.4",
    lastSeen: new Date().toISOString(),
    isActive: true,
    apiKey: "demo-device-key",
  });
}
