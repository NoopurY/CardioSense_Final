import { inferArrhythmia } from "@/lib/server/ml";
import { fail, ok } from "@/lib/server/http";
import { connectMongo } from "@/lib/server/mongodb";
import { DeviceModel, ECGRecordModel, PredictionModel } from "@/lib/server/models";

function processSignal(signal: number[]) {
  if (!signal.length) return [];

  const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
  const centered = signal.map((v) => v - mean);

  // Lightweight smoothing on backend for stable UI rendering from real sensor chunks.
  const alpha = 0.22;
  let state = centered[0] ?? 0;
  const smoothed = centered.map((v) => {
    state += alpha * (v - state);
    return state;
  });

  // Normalize amplitude based on current chunk's peak-to-peak range.
  const min = Math.min(...smoothed);
  const max = Math.max(...smoothed);
  const p2p = Math.max(max - min, 1e-6);
  const scale = 1.0 / p2p;
  return smoothed.map((v) => Math.max(-1.5, Math.min(1.5, v * scale * 2.0)));
}

function estimateBpm(signal: number[], samplingRate: number) {
  if (!signal.length || samplingRate <= 0) return 0;

  // Simple R-peak proxy: count local maxima above dynamic threshold.
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
  const variance = signal.reduce((a, b) => a + (b - mean) * (b - mean), 0) / signal.length;
  const std = Math.sqrt(Math.max(variance, 0));
  const threshold = mean + std * 0.8;
  const refractorySamples = Math.max(1, Math.round(samplingRate * 0.22));

  let peaks = 0;
  let lastPeak = -refractorySamples;
  for (let i = 1; i < signal.length - 1; i++) {
    const isPeak = signal[i] > signal[i - 1] && signal[i] >= signal[i + 1] && signal[i] > threshold;
    if (!isPeak) continue;
    if (i - lastPeak < refractorySamples) continue;
    peaks += 1;
    lastPeak = i;
  }

  const durationSec = signal.length / samplingRate;
  if (durationSec <= 0 || peaks === 0) return 0;

  const bpm = Math.round((peaks / durationSec) * 60);
  if (!Number.isFinite(bpm)) return 0;
  return Math.max(35, Math.min(210, bpm));
}

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

  const processedSignal = processSignal(signal);

  const avg = signal.reduce((a, b) => a + b, 0) / signal.length;
  const min = Math.min(...signal);
  const max = Math.max(...signal);
  const samplingRate = Number(device.samplingRate ?? 360) || 360;
  const bpm = estimateBpm(signal, samplingRate);

  const rec = await ECGRecordModel.create({
    userId: device.userId,
    deviceId: device._id,
    recordedAt: new Date(),
    durationSeconds: Math.max(1, Math.round(signal.length / samplingRate)),
    samplingRate,
    avgHeartRate: bpm,
    minHr: bpm > 0 ? Math.max(35, bpm - 6) : null,
    maxHr: bpm > 0 ? Math.min(210, bpm + 6) : null,
    source: "sensor" as const,
    signal,
    processedSignal,
  });

  const ml = inferArrhythmia(processedSignal.length ? processedSignal : signal);
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

  return ok({
    record_id: String(rec._id),
    bpm,
    accepted_samples: signal.length,
    prediction,
    accepted_at: new Date().toISOString(),
  });
}
