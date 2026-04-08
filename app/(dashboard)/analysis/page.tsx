"use client";

import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { LiveECGChart } from "@/components/charts/LiveECGChart";
import { api } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

type LatestPrediction = {
  predictionLabel?: string;
  arrhythmiaType?: string;
  confidence?: number;
  riskScore?: number;
  classId?: number;
  featuresJson?: {
    mean?: number;
    variance?: number;
    probabilities?: number[];
  };
  modelVersion?: string;
};

type UploadRecord = {
  _id: string;
  signal?: number[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const ARRHYTHMIA_CLASS_LABELS: Record<number, { short: string; full: string; description: string }> = {
  0: {
    short: "Normal",
    full: "Normal Sinus Rhythm",
    description: "Heart rhythm appears normal with regular P-QRS-T pattern and consistent RR intervals.",
  },
  1: {
    short: "SVE",
    full: "Supraventricular Ectopic Beat",
    description:
      "Extra beat originating above the ventricles. Occasional occurrences are generally benign but frequent bursts warrant monitoring.",
  },
  2: {
    short: "PVC",
    full: "Premature Ventricular Contraction",
    description:
      "Early heartbeat originating in the ventricles. Isolated PVCs are common; frequent PVCs may indicate structural heart disease.",
  },
  3: {
    short: "Fusion",
    full: "Fusion Beat",
    description:
      "A beat that fuses a normal sinus impulse with a ventricular beat. Often seen in patients with PVCs.",
  },
  4: {
    short: "Unknown / Q",
    full: "Unclassifiable Beat",
    description:
      "The model could not confidently classify this rhythm. Signal quality or an unusual morphology may be the cause.",
  },
};

const NEXT_STEPS: Record<string, string[]> = {
  low: [
    "Continue regular monitoring as scheduled.",
    "Maintain existing lifestyle and medication routine.",
    "No immediate clinical action required.",
  ],
  moderate: [
    "Review results with your cardiologist at your next appointment.",
    "Avoid strenuous activity if experiencing symptoms.",
    "Monitor for palpitations, dizziness, or chest discomfort.",
  ],
  high: [
    "Seek medical evaluation promptly, especially if symptomatic.",
    "Do not drive or operate heavy machinery until reviewed by a physician.",
    "If experiencing chest pain, shortness of breath, or fainting — call emergency services.",
  ],
};

// ─── CSV Parser ──────────────────────────────────────────────────────────────

function parseCsvSignal(text: string): number[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const signal: number[] = [];

  for (const line of lines) {
    const cols = line.split(/[;,\s]+/).filter(Boolean);
    if (!cols.length) continue;

    for (const col of cols) {
      const cleaned = col.replace(/^['"\[\](){}]+|['"\[\](){}]+$/g, "");
      const value = Number(cleaned);
      if (Number.isFinite(value)) {
        signal.push(value);
      }
    }
  }

  return signal;
}

// ─── Signal Analysis Utilities ────────────────────────────────────────────────

function detectRPeaks(signal: number[], sr = 360): number[] {
  if (!signal.length) return [];

  const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
  const max = Math.max(...signal);
  const threshold = mean + 0.35 * Math.max(max - mean, 0.01);

  const minGap = Math.round(sr * 0.25); // 250 ms minimum between peaks
  const peaks: number[] = [];
  let lastPeak = -minGap;

  for (let i = 1; i < signal.length - 1; i++) {
    if (
      signal[i] > signal[i - 1] &&
      signal[i] >= signal[i + 1] &&
      signal[i] > threshold &&
      i - lastPeak >= minGap
    ) {
      peaks.push(i);
      lastPeak = i;
    }
  }

  return peaks;
}

function computeRRIntervals(peaks: number[], sr = 360): number[] {
  const rr: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    rr.push(((peaks[i] - peaks[i - 1]) / sr) * 1000); // ms
  }
  return rr;
}

function computeRMSSD(rrMs: number[]): number | null {
  if (rrMs.length < 2) return null;
  let sum = 0;
  for (let i = 1; i < rrMs.length; i++) {
    const diff = rrMs[i] - rrMs[i - 1];
    sum += diff * diff;
  }
  return Math.sqrt(sum / (rrMs.length - 1));
}

function computeSDNN(rrMs: number[]): number | null {
  if (rrMs.length < 2) return null;
  const mean = rrMs.reduce((a, b) => a + b, 0) / rrMs.length;
  const variance = rrMs.reduce((a, b) => a + (b - mean) ** 2, 0) / rrMs.length;
  return Math.sqrt(variance);
}

function qualityScore(snrDb: number | null, baseline: string, rrCount: number, duration: number): number {
  let score = 0;

  // SNR component (0–40 pts)
  if (snrDb !== null) {
    if (snrDb >= 20) score += 40;
    else if (snrDb >= 15) score += 32;
    else if (snrDb >= 8) score += 20;
    else score += 8;
  }

  // Baseline component (0–20 pts)
  if (baseline === "Stable") score += 20;
  else if (baseline === "Mild drift") score += 12;
  else score += 4;

  // Duration component (0–25 pts)
  if (duration >= 30) score += 25;
  else if (duration >= 10) score += 16;
  else if (duration >= 5) score += 8;
  else score += 2;

  // Beat count component (0–15 pts)
  if (rrCount >= 20) score += 15;
  else if (rrCount >= 10) score += 10;
  else if (rrCount >= 4) score += 5;

  return Math.min(100, Math.round(score));
}

function qualityBarColor(score: number): string {
  if (score >= 75) return "linear-gradient(90deg, #00ff88, #00d4ff)";
  if (score >= 45) return "linear-gradient(90deg, #ffcc00, #ff8c00)";
  return "linear-gradient(90deg, #ff2244, #ff6600)";
}

function rhythmRegularity(rrMs: number[]): { label: string; cv: number | null } {
  if (rrMs.length < 3) return { label: "Insufficient data", cv: null };
  const mean = rrMs.reduce((a, b) => a + b, 0) / rrMs.length;
  const sd = Math.sqrt(rrMs.reduce((a, b) => a + (b - mean) ** 2, 0) / rrMs.length);
  const cv = (sd / mean) * 100; // coefficient of variation %
  if (cv < 5) return { label: "Very Regular", cv };
  if (cv < 10) return { label: "Regular", cv };
  if (cv < 20) return { label: "Mildly Irregular", cv };
  return { label: "Irregular", cv };
}

function aFibLikelihood(rrMs: number[], bpm: number | null): string {
  if (rrMs.length < 5 || bpm === null) return "Insufficient data";
  const sdnn = computeSDNN(rrMs);
  if (sdnn === null) return "Insufficient data";
  const mean = rrMs.reduce((a, b) => a + b, 0) / rrMs.length;
  const cv = (sdnn / mean) * 100;
  if (cv >= 20 && bpm >= 100) return "Elevated";
  if (cv >= 15) return "Possible";
  return "Low";
}

function riskLevel(score: number): "low" | "moderate" | "high" {
  if (score < 0.35) return "low";
  if (score < 0.65) return "moderate";
  return "high";
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const [prediction, setPrediction] = useState<LatestPrediction | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [uploadedSignal, setUploadedSignal] = useState<number[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [statusText, setStatusText] = useState("Upload a CSV file and click Run Analysis.");
  const [errorText, setErrorText] = useState<string | null>(null);

  // ── File selection ──────────────────────────────────────────────────────────
  const handleCsvSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPrediction(null);
    setErrorText(null);
    setStatusText("Parsing CSV…");
    setSelectedFileName(file.name);

    try {
      const text = await file.text();
      const signal = parseCsvSignal(text);
      if (signal.length < 12) {
        setUploadedSignal([]);
        setStatusText("CSV parsed, but no valid ECG points found.");
        setErrorText("CSV must contain at least 12 numeric values.");
        return;
      }

      setUploadedSignal(signal);
      setStatusText(`✓ Loaded ${signal.length.toLocaleString()} samples from "${file.name}"`);
    } catch {
      setUploadedSignal([]);
      setStatusText("Unable to parse CSV.");
      setErrorText("Could not read this file. Use a plain CSV with numeric ECG samples.");
    }
  };

  // ── Run analysis ────────────────────────────────────────────────────────────
  const runAnalysis = async () => {
    if (uploadedSignal.length < 12 || isRunning) return;

    setIsRunning(true);
    setErrorText(null);
    setStatusText("Uploading ECG record…");

    try {
      const uploadRes = await api.post<UploadRecord>("/api/ecg/upload", {
        signal: uploadedSignal,
        duration_seconds: Math.max(1, Math.round(uploadedSignal.length / 360)),
        sampling_rate: 360,
      });

      const recordId = uploadRes.data?._id;
      if (!recordId) throw new Error("Upload succeeded but no record ID returned.");

      setStatusText("Running AI inference…");
      const analyzeRes = await api.post<LatestPrediction>(`/api/ecg/${recordId}/analyze`);
      setPrediction(analyzeRes.data ?? null);
      setStatusText("✓ Analysis complete — results ready below.");
    } catch (error) {
      let message = error instanceof Error ? error.message : "Failed to run analysis.";

      if (isAxiosError(error)) {
        if (error.response?.status === 401) {
          message = "Your session expired. Please log in again.";
          window.location.href = "/auth/login";
        } else {
          const apiError = error.response?.data as { error?: string } | undefined;
          if (apiError?.error) message = apiError.error;
        }
      }

      setStatusText("Analysis failed.");
      setErrorText(message);
    } finally {
      setIsRunning(false);
    }
  };

  // ── Signal metrics ──────────────────────────────────────────────────────────

  const peaks = useMemo(() => detectRPeaks(uploadedSignal, 360), [uploadedSignal]);

  const rrIntervals = useMemo(() => computeRRIntervals(peaks, 360), [peaks]);

  const uploadedBpm = useMemo(() => {
    if (!rrIntervals.length) return null;
    const meanRR = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
    const bpm = Math.round(60000 / meanRR);
    return Number.isFinite(bpm) && bpm > 20 && bpm < 300 ? bpm : null;
  }, [rrIntervals]);

  const minMaxHR = useMemo(() => {
    if (rrIntervals.length < 2) return { min: null, max: null };
    const bpms = rrIntervals.map((rr) => Math.round(60000 / rr)).filter((b) => b > 20 && b < 300);
    if (!bpms.length) return { min: null, max: null };
    return { min: Math.min(...bpms), max: Math.max(...bpms) };
  }, [rrIntervals]);

  const hrv = useMemo(() => {
    const rmssd = computeRMSSD(rrIntervals);
    const sdnn = computeSDNN(rrIntervals);
    return { rmssd, sdnn };
  }, [rrIntervals]);

  const rhythm = useMemo(() => rhythmRegularity(rrIntervals), [rrIntervals]);

  const afibFlag = useMemo(() => aFibLikelihood(rrIntervals, uploadedBpm), [rrIntervals, uploadedBpm]);

  const quality = useMemo(() => {
    if (!uploadedSignal.length) {
      return { snrDb: null as number | null, baseline: "--", noise: null as number | null, amplitude: null as number | null };
    }
    const window = uploadedSignal.slice(-360);
    const n = window.length;
    if (!n) return { snrDb: null as number | null, baseline: "--", noise: null as number | null, amplitude: null as number | null };

    let mean = 0;
    for (const v of window) mean += v;
    mean /= n;

    let varSignal = 0;
    for (const v of window) { const d = v - mean; varSignal += d * d; }
    varSignal /= n;

    let diffSq = 0;
    for (let i = 1; i < window.length; i++) { const d = window[i] - window[i - 1]; diffSq += d * d; }

    const noise = Math.sqrt(diffSq / Math.max(1, window.length - 1));
    const signalRms = Math.sqrt(Math.max(varSignal, 1e-9));
    const snrDb = 20 * Math.log10(Math.max(signalRms / Math.max(noise, 1e-6), 1e-6));
    const min = Math.min(...window);
    const max = Math.max(...window);
    const amplitude = max - min;
    const baseline = Math.abs(mean) < 0.05 ? "Stable" : Math.abs(mean) < 0.12 ? "Mild drift" : "High drift";

    return { snrDb, baseline, noise, amplitude };
  }, [uploadedSignal]);

  const durationSeconds = useMemo(() => Math.round(uploadedSignal.length / 360), [uploadedSignal]);

  const overallQualityScore = useMemo(
    () => qualityScore(quality.snrDb, quality.baseline, rrIntervals.length, durationSeconds),
    [quality.snrDb, quality.baseline, rrIntervals.length, durationSeconds],
  );

  // ── Charts data ─────────────────────────────────────────────────────────────

  const normalChartData = useMemo(() => {
    if (uploadedSignal.length < 12) return [] as Array<{ x: number; p: number }>;
    const window = uploadedSignal.slice(-360);
    const n = window.length;
    if (!n) return [];
    const min = Math.min(...window);
    const max = Math.max(...window);
    const bins = 12;
    const span = Math.max(max - min, 1e-6);
    const width = span / bins;
    const counts = new Array(bins).fill(0);
    for (const value of window) {
      const raw = Math.floor((value - min) / width);
      counts[Math.min(bins - 1, Math.max(0, raw))] += 1;
    }
    return counts.map((count, i) => ({ x: Number((min + width * (i + 0.5)).toFixed(3)), p: Number((count / n).toFixed(4)) }));
  }, [uploadedSignal]);

  const poissonChartData = useMemo(() => {
    if (uploadedSignal.length < 12) return [] as Array<{ k: number; p: number }>;
    const window = uploadedSignal.slice(-360);
    const mean = window.reduce((a, b) => a + b, 0) / Math.max(1, window.length);
    const max = Math.max(...window);
    const threshold = mean + 0.25 * Math.max(max - mean, 0.01);
    let peaksN = 0;
    for (let i = 1; i < window.length - 1; i++) {
      if (window[i] > window[i - 1] && window[i] >= window[i + 1] && window[i] > threshold) peaksN++;
    }
    const seconds = window.length / 360;
    const lambda = Math.max(0.05, peaksN / Math.max(seconds, 1e-6));
    const kMax = Math.max(4, Math.min(10, Math.ceil(lambda + 3 * Math.sqrt(lambda))));
    const fact = (n: number): number => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
    return Array.from({ length: kMax + 1 }, (_, k) => ({ k, p: Number(((Math.exp(-lambda) * lambda ** k) / fact(k)).toFixed(4)) }));
  }, [uploadedSignal]);

  const correlationData = useMemo(() => {
    if (uploadedSignal.length < 60) return [] as Array<{ x: number; y: number }>;
    const window = uploadedSignal.slice(-360);
    const chunkSize = 30;
    return Array.from({ length: Math.floor(window.length / chunkSize) }, (_, idx) => {
      const chunk = window.slice(idx * chunkSize, (idx + 1) * chunkSize);
      const cm = chunk.reduce((a, b) => a + b, 0) / chunk.length;
      const cMax = Math.max(...chunk);
      const th = cm + 0.25 * Math.max(cMax - cm, 0.01);
      let pks = 0;
      for (let i = 1; i < chunk.length - 1; i++) {
        if (chunk[i] > chunk[i - 1] && chunk[i] >= chunk[i + 1] && chunk[i] > th) pks++;
      }
      const bpmProxy = (pks / Math.max(chunk.length / 360, 1e-6)) * 60;
      const variance = chunk.reduce((acc, v) => acc + (v - cm) ** 2, 0) / chunk.length;
      return { x: Number(bpmProxy.toFixed(1)), y: Number((Math.sqrt(variance) * 1000).toFixed(1)) };
    });
  }, [uploadedSignal]);

  // ── Derived display values ──────────────────────────────────────────────────

  const predRiskLevel = prediction?.riskScore !== undefined ? riskLevel(prediction.riskScore) : null;

  const classMeta = prediction?.classId !== undefined ? ARRHYTHMIA_CLASS_LABELS[prediction.classId] : null;

  const riskBadgeClass =
    predRiskLevel === "low" ? "risk-badge risk-badge-low" :
    predRiskLevel === "moderate" ? "risk-badge risk-badge-moderate" :
    predRiskLevel === "high" ? "risk-badge risk-badge-high" : "";

  const riskIcon = predRiskLevel === "low" ? "✓" : predRiskLevel === "moderate" ? "⚠" : "⛔";

  const confidencePct = typeof prediction?.confidence === "number" ? Math.round(prediction.confidence * 100) : null;

  const confidenceBarColor =
    confidencePct !== null && confidencePct >= 80
      ? "#00d4ff"
      : confidencePct !== null && confidencePct >= 60
      ? "#ffcc00"
      : "#ff2244";

  const probabilities = prediction?.featuresJson?.probabilities ?? null;

  const clinicalCardClass =
    predRiskLevel === "high" ? "clinical-card-danger" :
    predRiskLevel === "moderate" ? "clinical-card-warning" : "clinical-card";

  return (
    <div className="space-y-5">

      {/* ── Upload + Run ─────────────────────────────────────── */}
      <Panel title="ECG Check" subtitle="Upload your ECG CSV file and get an easy-to-read result">
        <div className="grid gap-4 md:grid-cols-[1.25fr,1fr]">
          <label className="rounded-2xl border border-cyan-700/40 bg-linear-to-b from-[#07233a] to-[#041a2e] p-6 text-sm text-slate-200 cursor-pointer hover:border-cyan-500/60 transition-colors">
            <p className="text-base font-medium text-cyan-200">📂 Upload ECG CSV</p>
            <p className="mt-1 text-xs text-slate-400">
              Upload a simple numeric CSV. Keep your hand still while recording for better accuracy.
            </p>
            <input className="mt-4 block text-xs" type="file" accept=".csv,text/csv" onChange={handleCsvSelection} />
          </label>

          <div className="rounded-2xl border border-slate-700 bg-[#07192a] p-5 flex flex-col justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400">
                {selectedFileName ? `📄 ${selectedFileName}` : "No file selected"}
              </p>
              <p className="mt-1 text-xs text-slate-400">{statusText}</p>
              {errorText ? <p className="mt-2 text-xs text-rose-300">⚠ {errorText}</p> : null}
            </div>
            <Button
              onClick={() => void runAnalysis()}
              disabled={uploadedSignal.length < 12 || isRunning}
            >
              {isRunning ? "⏳ Analyzing..." : "▶ Analyze ECG"}
            </Button>
          </div>
        </div>
      </Panel>

      {/* ── Waveform Viewer ──────────────────────────────────── */}
      <Panel title="ECG Wave" subtitle={uploadedSignal.length ? `Recording length: ~${durationSeconds}s` : "No recording loaded"}>
        <LiveECGChart points={uploadedSignal} />
      </Panel>

      {/* ── Patient-friendly summary + AI Result ────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Simple Heart Summary" subtitle="Important points in plain language">
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              <span className="text-slate-400">Heart rate:</span>{" "}
              <strong className="text-cyan-200">{uploadedBpm ?? "--"} {uploadedBpm !== null ? "bpm" : ""}</strong>
            </p>
            <p>
              <span className="text-slate-400">Heart rhythm:</span>{" "}
              <strong className="text-slate-100">{rhythm.label === "Insufficient data" ? "Not enough data yet" : rhythm.label}</strong>
            </p>
            <p>
              <span className="text-slate-400">Signal quality:</span>{" "}
              <strong className="text-slate-100">
                {uploadedSignal.length === 0
                  ? "No data"
                  : overallQualityScore >= 75
                  ? "Good"
                  : overallQualityScore >= 45
                  ? "Fair"
                  : "Poor"}
              </strong>
            </p>
            <p className="text-xs text-slate-400">
              This is a supportive tool. It does not replace advice from your doctor.
            </p>
          </div>
        </Panel>

        <Panel title="AI Result" subtitle="Main result you should focus on">
          {prediction ? (
            <div className="space-y-4 text-sm text-slate-300">

              {/* Risk badge */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={riskBadgeClass}>
                  {riskIcon} {predRiskLevel === "low" ? "Low Risk" : predRiskLevel === "moderate" ? "Moderate Risk" : "High Risk"}
                </span>
                {classMeta && (
                  <span className="text-xs text-cyan-200 font-medium">{classMeta.short}</span>
                )}
              </div>

              {/* Classification */}
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Result</p>
                <p className="mono-data text-base mt-0.5">
                  {classMeta?.full ?? prediction.predictionLabel ?? prediction.arrhythmiaType ?? "--"}
                </p>
              </div>

              {/* Confidence bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs uppercase tracking-wide text-slate-500">How sure the AI is</p>
                  <p className="mono-data text-lg">{confidencePct !== null ? `${confidencePct}%` : "--"}</p>
                </div>
                <div className="quality-bar-track">
                  <div
                    className="quality-bar-fill"
                    style={{ width: confidencePct !== null ? `${confidencePct}%` : "0%", background: `linear-gradient(90deg, ${confidenceBarColor}, ${confidenceBarColor}aa)` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {confidencePct !== null && confidencePct >= 85 ? "AI is very sure about this result." :
                   confidencePct !== null && confidencePct >= 65 ? "AI is moderately sure about this result." :
                   confidencePct !== null ? "AI is less sure. A new recording may help." :
                   ""}
                </p>
              </div>

              {/* Risk score */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Risk level score</p>
                  <p className="mono-data text-lg">
                    {typeof prediction.riskScore === "number" ? `${Math.round(prediction.riskScore * 100)} / 100` : "--"}
                  </p>
                </div>
                <div className="quality-bar-track">
                  <div
                    className="quality-bar-fill"
                    style={{
                      width: typeof prediction.riskScore === "number" ? `${Math.round(prediction.riskScore * 100)}%` : "0%",
                      background: predRiskLevel === "high" ? "linear-gradient(90deg, #ff2244, #ff6600)" :
                                  predRiskLevel === "moderate" ? "linear-gradient(90deg, #ffcc00, #ff8c00)" :
                                  "linear-gradient(90deg, #00ff88, #00d4ff)",
                    }}
                  />
                </div>
              </div>

            </div>
          ) : (
            <div className="text-sm text-slate-400 space-y-2">
              <p>No prediction yet.</p>
              <p className="text-xs text-slate-500">Upload a CSV file and click <strong className="text-cyan-400">▶ Analyze ECG</strong> to view your result and next steps.</p>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Clinical Interpretation ──────────────────────────── */}
      {(prediction || uploadedSignal.length > 0) && (
        <Panel title="What This Means" subtitle="Simple explanation based on your latest analysis">
          <div className={clinicalCardClass}>
            <p className="text-sm leading-relaxed text-slate-200">
              {prediction ? (
                <>
                  Your ECG is classified as{" "}
                  <strong className="text-cyan-300">{classMeta?.full ?? prediction.predictionLabel ?? "Unknown"}</strong>
                  {uploadedBpm ? (
                    <> with an average heart rate of{" "}
                      <strong className={`${uploadedBpm < 50 ? "text-amber-400" : uploadedBpm > 100 ? "text-rose-400" : "text-cyan-300"}`}>
                        {uploadedBpm} bpm
                      </strong>
                    </>
                  ) : null}
                  .{" "}
                  {classMeta?.description ?? ""}{" "}
                  {rhythm.label !== "Insufficient data" ? (
                    <>Your heartbeat pattern appears <strong className="text-slate-100">{rhythm.label.toLowerCase()}</strong>.</>
                  ) : null}
                  {afibFlag === "Elevated" ? (
                    <> <strong className="text-rose-300">There may be signs that need urgent medical review.</strong></>
                  ) : afibFlag === "Possible" ? (
                    <> Some irregularity is seen. Please discuss with your doctor.</>
                  ) : null}
                </>
              ) : (
                uploadedSignal.length > 0 ? (
                  <>
                    Signal loaded: <strong className="text-cyan-300">{uploadedSignal.length.toLocaleString()} samples</strong> (~{durationSeconds}s at 360 Hz),{" "}
                    {peaks.length} beats detected, mean HR{" "}
                    <strong className="text-cyan-300">{uploadedBpm ?? "--"} bpm</strong>.{" "}
                    Click <strong className="text-cyan-400">▶ Analyze ECG</strong> to get your result.
                  </>
                ) : (
                  "Upload a CSV file to begin analysis."
                )
              )}
            </p>
          </div>

          {/* Next steps */}
          {prediction && predRiskLevel && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Recommended Next Steps</p>
              <ul className="space-y-1.5">
                {NEXT_STEPS[predRiskLevel].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className={`mt-0.5 shrink-0 text-xs ${predRiskLevel === "high" ? "text-rose-400" : predRiskLevel === "moderate" ? "text-amber-400" : "text-emerald-400"}`}>
                      {predRiskLevel === "high" ? "⛔" : predRiskLevel === "moderate" ? "⚠" : "✓"}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
