import { Schema, model, models } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String },
    name: { type: String, required: true },
    dob: String,
    gender: String,
    bloodGroup: String,
    avatarUrl: String,
    isActive: { type: Boolean, default: true },
    isAdmin: { type: Boolean, default: false },
    provider: { type: String, default: "credentials" },
    providerAccountId: String,
  },
  { timestamps: true },
);

const DeviceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceIdStr: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    location: String,
    firmwareVersion: String,
    isActive: { type: Boolean, default: true },
    apiKey: { type: String, required: true, index: true },
    sensorConnected: { type: Boolean, default: false },
    heartbeatAt: Date,
    lastSeen: Date,
    samplingRate: { type: Number, default: 360 },
    signalStrength: { type: Number, default: 0 },
    battery: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const ECGRecordSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceId: { type: Schema.Types.ObjectId, ref: "Device", required: true, index: true },
    recordedAt: { type: Date, required: true },
    durationSeconds: Number,
    samplingRate: Number,
    avgHeartRate: Number,
    minHr: Number,
    maxHr: Number,
    source: { type: String, enum: ["upload", "sensor", "simulated"], required: true },
    signal: { type: [Number], default: [] },
  },
  { timestamps: true },
);

const PredictionSchema = new Schema(
  {
    ecgRecordId: { type: Schema.Types.ObjectId, ref: "ECGRecord", required: true, index: true },
    predictedAt: Date,
    predictionLabel: String,
    arrhythmiaType: String,
    confidence: Number,
    riskScore: Number,
    classId: Number,
    featuresJson: { type: Schema.Types.Mixed, default: {} },
    modelVersion: String,
  },
  { timestamps: true },
);

const ReportSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    generatedAt: { type: Date, required: true },
    dateFrom: Date,
    dateTo: Date,
    filePath: String,
    notes: String,
  },
  { timestamps: true },
);

const AlertSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ecgRecordId: { type: Schema.Types.ObjectId, ref: "ECGRecord", required: true, index: true },
    triggeredAt: { type: Date, required: true },
    alertType: { type: String, required: true },
    severity: { type: String, enum: ["info", "warning", "critical"], required: true },
    message: { type: String, required: true },
    isAcknowledged: { type: Boolean, default: false },
    acknowledgedAt: Date,
  },
  { timestamps: true },
);

const AlertSettingsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    bpmHigh: { type: Number, default: 120 },
    bpmLow: { type: Number, default: 50 },
    spo2Low: { type: Number, default: 92 },
    hrvLow: { type: Number, default: 22 },
    emailAlerts: { type: Boolean, default: true },
    pushAlerts: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const UserModel = models.User ?? model("User", UserSchema);
export const DeviceModel = models.Device ?? model("Device", DeviceSchema);
export const ECGRecordModel = models.ECGRecord ?? model("ECGRecord", ECGRecordSchema);
export const PredictionModel = models.Prediction ?? model("Prediction", PredictionSchema);
export const ReportModel = models.Report ?? model("Report", ReportSchema);
export const AlertModel = models.Alert ?? model("Alert", AlertSchema);
export const AlertSettingsModel = models.AlertSettings ?? model("AlertSettings", AlertSettingsSchema);
