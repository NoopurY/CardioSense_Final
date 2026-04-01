export type User = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  avatarUrl?: string;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
  isAdmin: boolean;
};

export type Device = {
  id: string;
  userId: string;
  deviceIdStr: string;
  name: string;
  location?: string;
  firmwareVersion?: string;
  lastSeen?: string;
  isActive: boolean;
  apiKey: string;
};

export type ECGPoint = number;

export type ECGRecord = {
  id: string;
  userId: string;
  deviceId: string;
  recordedAt: string;
  durationSeconds: number;
  samplingRate: number;
  avgHeartRate: number;
  minHr: number;
  maxHr: number;
  source: "upload" | "sensor" | "simulated";
  signal: ECGPoint[];
};

export type Prediction = {
  id: string;
  ecgRecordId: string;
  predictedAt: string;
  predictionLabel: string;
  arrhythmiaType: string;
  confidence: number;
  riskScore: number;
  classId: number;
  featuresJson: Record<string, number>;
  modelVersion: string;
};

export type Alert = {
  id: string;
  userId: string;
  ecgRecordId: string;
  triggeredAt: string;
  alertType: string;
  severity: "info" | "warning" | "critical";
  message: string;
  isAcknowledged: boolean;
  acknowledgedAt?: string;
};
