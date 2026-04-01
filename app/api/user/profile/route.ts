
import { fail, ok, requireUser } from "@/lib/server/http";
import { sanitizeText } from "@/lib/server/sanitize";
import { connectMongo } from "@/lib/server/mongodb";
import { UserModel, DeviceModel, ECGRecordModel, PredictionModel } from "@/lib/server/models";

function toRiskLabel(riskScore?: number | null) {
  if (riskScore == null) return "Unknown";
  if (riskScore >= 70) return "High";
  if (riskScore >= 40) return "Medium";
  return "Low";
}

function toWindowStatus(scores: number[]) {
  if (!scores.length) return "No data";
  const max = Math.max(...scores);
  if (max >= 70) return "Critical";
  if (max >= 40) return "Watch";
  return "Normal";
}

export async function GET() {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const user: any = await UserModel.findOne({ _id: auth.sub }).lean();
  if (!user) return fail("User not found", 404);

  // Profile basics
  const profile: any = {
    name: user.name,
    dob: user.dob,
    bloodGroup: user.bloodGroup,
    gender: user.gender,
    avatarUrl: user.avatarUrl,
    conditions: user.conditions || [],
  };


  // Device status
  const device: any = await DeviceModel.findOne({ userId: user._id, isActive: true }).lean();
  if (device) {
    const heartbeatAgeMs = device.heartbeatAt ? Date.now() - new Date(device.heartbeatAt).getTime() : Number.MAX_SAFE_INTEGER;
    const connected = Boolean(device.sensorConnected && heartbeatAgeMs <= 12000);
    profile.deviceStatus = connected ? "ESP32 Connected" : "Device Offline";
    profile.signalStrength = device.signalStrength ?? null;
    profile.battery = device.battery ?? null;
  } else {
    profile.deviceStatus = "No device connected";
    profile.signalStrength = null;
    profile.battery = null;
  }

  // ECG/HRV
  const records = await ECGRecordModel.find({ userId: user._id }).sort({ recordedAt: -1 }).limit(200).lean();
  if (records.length) {
    const recordIds = records.map((r) => r._id);
    const predictions: any[] = await PredictionModel.find({ ecgRecordId: { $in: recordIds } }).lean();
    const predictionByRecord = new Map(
      predictions.map((p) => [String(p.ecgRecordId), p]),
    );

    const latestRecord = records[0];
    const latestPrediction = predictionByRecord.get(String(latestRecord._id));
    profile.latestBpm = latestRecord.avgHeartRate ?? null;
    profile.hrv = null;
    profile.riskScore = latestPrediction?.riskScore ?? null;
    profile.prediction = latestPrediction?.predictionLabel ?? latestPrediction?.arrhythmiaType ?? null;

    const now = Date.now();
    const windows = [
      { label: "1D", ms: 24 * 60 * 60 * 1000 },
      { label: "1W", ms: 7 * 24 * 60 * 60 * 1000 },
      { label: "1M", ms: 30 * 24 * 60 * 60 * 1000 },
    ];
    profile.ecgHistory = windows.map((window) => {
      const scores = records
        .filter((r) => {
          const at = new Date(r.recordedAt).getTime();
          return Number.isFinite(at) && now - at <= window.ms;
        })
        .map((r) => predictionByRecord.get(String(r._id))?.riskScore)
        .filter((v): v is number => typeof v === "number");

      return {
        label: window.label,
        status: toWindowStatus(scores),
      };
    });

    const insights: string[] = [];
    if (latestPrediction?.arrhythmiaType && latestPrediction.arrhythmiaType !== "Normal") {
      insights.push(`Latest analysis detected ${latestPrediction.arrhythmiaType}.`);
    }
    if (typeof latestRecord.avgHeartRate === "number") {
      if (latestRecord.avgHeartRate > 100) insights.push("Latest average heart rate is above normal range.");
      if (latestRecord.avgHeartRate < 60) insights.push("Latest average heart rate is below normal range.");
    }
    if (typeof latestPrediction?.riskScore === "number") {
      insights.push(`Current risk classification: ${toRiskLabel(latestPrediction.riskScore)}.`);
    }
    profile.insights = insights;
  } else {
    // New user: show empty/defaults
    profile.latestBpm = null;
    profile.hrv = null;
    profile.ecgHistory = [];
    profile.riskScore = null;
    profile.prediction = null;
    profile.insights = [];
  }


  return ok({ data: profile });
}

export async function PUT(request: Request) {
  await connectMongo();
  const auth = await requireUser();
  if (!auth) return fail("Unauthorized", 401);
  const user = await UserModel.findOne({ _id: auth.sub });
  if (!user) return fail("User not found", 404);

  const body = await request.json();
  user.name = sanitizeText(body.name) || user.name;
  user.gender = sanitizeText(body.gender) || user.gender;
  user.bloodGroup = sanitizeText(body.blood_group) || user.bloodGroup;
  await user.save();

  return ok({ updated: true, user });
}
