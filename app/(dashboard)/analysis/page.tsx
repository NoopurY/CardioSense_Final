"use client";

import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { LiveECGChart } from "@/components/charts/LiveECGChart";
import { NormalDistributionChart, PoissonChart } from "@/components/charts/DistributionChart";
import { CorrelationPlot } from "@/components/charts/CorrelationPlot";
import { RRIntervalChart } from "@/components/charts/RRIntervalChart";
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
      <Panel title="ECG Analysis" subtitle="Upload a CSV file and run AI-assisted arrhythmia detection">
        <div className="grid gap-4 md:grid-cols-[1.25fr,1fr]">
          <label className="rounded-2xl border border-cyan-700/40 bg-linear-to-b from-[#07233a] to-[#041a2e] p-6 text-sm text-slate-200 cursor-pointer hover:border-cyan-500/60 transition-colors">
            <p className="text-base font-medium text-cyan-200">📂 Upload ECG CSV</p>
            <p className="mt-1 text-xs text-slate-400">
              Plain numeric values, one or more per line. Minimum 12 samples. Typical ECG at 360 Hz = ~360 values/sec.
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
              {isRunning ? "⏳ Running Analysis…" : "▶ Run AI Analysis"}
            </Button>
          </div>
        </div>
      </Panel>

      {/* ── Waveform Viewer ──────────────────────────────────── */}
      <Panel title="Waveform Viewer" subtitle={uploadedSignal.length ? `${uploadedSignal.length.toLocaleString()} samples · ~${durationSeconds}s · 360 Hz` : "No signal loaded"}>
        <LiveECGChart points={uploadedSignal} />
      </Panel>

      {/* ── RR Interval Chart ────────────────────────────────── */}
      <Panel
        title="Beat-to-Beat RR Intervals"
        subtitle={rrIntervals.length ? `${rrIntervals.length} intervals detected · Color: cyan=normal, red=tachycardia, amber=bradycardia` : "Detected beats will appear here"}
      >
        <RRIntervalChart rrIntervals={rrIntervals} />
      </Panel>

      {/* ── Signal Quality + AI Result ───────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Signal Quality */}
        <Panel title="Signal Quality">
          {/* Overall score bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400 uppercase tracking-wide">Overall Quality Score</span>
              <span className="mono-data text-lg font-bold">{uploadedSignal.length ? `${overallQualityScore}%` : "--"}</span>
            </div>
            <div className="quality-bar-track">
              <div
                className="quality-bar-fill"
                style={{
                  width: uploadedSignal.length ? `${overallQualityScore}%` : "0%",
                  background: qualityBarColor(overallQualityScore),
                }}
              />
            </div>
            {uploadedSignal.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                {overallQualityScore >= 75 ? "✓ Good signal — results will be reliable." :
                 overallQualityScore >= 45 ? "⚠ Moderate quality — results may have reduced accuracy." :
                 "✗ Poor quality — consider re-recording in a quiet, still environment."}
              </p>
            )}
          </div>

          <div className="space-y-3 text-sm text-slate-300">
            {/* BPM */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Heart Rate (avg)</p>
                <p className="mono-data text-xl mt-0.5">{uploadedBpm ?? "--"} <span className="text-xs text-slate-400">bpm</span></p>
              </div>
              <div className="text-right text-xs text-slate-400">
                {uploadedBpm == null ? "Awaiting data" :
                 uploadedBpm < 50 ? <span className="text-amber-400">⚠ Bradycardia (&lt;50 bpm)</span> :
                 uploadedBpm > 100 ? <span className="text-rose-400">⚠ Tachycardia (&gt;100 bpm)</span> :
                 <span className="text-emerald-400">✓ Normal range (50–100 bpm)</span>}
              </div>
            </div>

            {/* Min/Max HR */}
            <div className="flex gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Min HR</p>
                <p className="mono-data">{minMaxHR.min ?? "--"} <span className="text-xs text-slate-400">bpm</span></p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Max HR</p>
                <p className="mono-data">{minMaxHR.max ?? "--"} <span className="text-xs text-slate-400">bpm</span></p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Beats detected</p>
                <p className="mono-data">{peaks.length > 0 ? peaks.length : "--"}</p>
              </div>
            </div>

            {/* HRV */}
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">HRV — RMSSD</p>
              <p className="mono-data">{hrv.rmssd !== null ? `${hrv.rmssd.toFixed(1)} ms` : "--"}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {hrv.rmssd === null ? "Requires ≥2 detected beats." :
                 hrv.rmssd > 50 ? "Good autonomic variability — typical of healthy individuals." :
                 hrv.rmssd > 20 ? "Moderate HRV — stress, sleep deprivation, or early disease may lower HRV." :
                 "Low HRV — associated with elevated cardiovascular risk and autonomic dysfunction."}
              </p>
            </div>

            {/* SDNN */}
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">HRV — SDNN</p>
              <p className="mono-data">{hrv.sdnn !== null ? `${hrv.sdnn.toFixed(1)} ms` : "--"}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {hrv.sdnn === null ? "Requires ≥2 detected beats." :
                 hrv.sdnn > 100 ? "High SDNN — excellent overall heart rate variability." :
                 hrv.sdnn > 50 ? "Normal SDNN — within healthy adult range." :
                 "Below normal SDNN — may indicate reduced cardiac reserve."}
              </p>
            </div>

            {/* Rhythm Regularity */}
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Rhythm Regularity</p>
              <p className="mono-data">{rhythm.label}{rhythm.cv !== null ? ` (CV: ${rhythm.cv.toFixed(1)}%)` : ""}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {rhythm.label === "Very Regular" ? "Heartbeats are very evenly spaced — consistent with normal sinus rhythm." :
                 rhythm.label === "Regular" ? "Rhythm is regular with minor physiological variation." :
                 rhythm.label === "Mildly Irregular" ? "Slight irregularity detected — may be normal variation or early dysrhythmia." :
                 rhythm.label === "Irregular" ? "Significant beat-to-beat irregularity — warrants clinical review." :
                 "Not enough beats to assess regularity."}
              </p>
            </div>

            {/* AFib likelihood */}
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">AFib Likelihood</p>
              <p className={`mono-data ${afibFlag === "Elevated" ? "text-rose-400" : afibFlag === "Possible" ? "text-amber-400" : ""}`}>
                {afibFlag}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {afibFlag === "Elevated" ? "High RR variability with elevated rate — atrial fibrillation should be ruled out clinically." :
                 afibFlag === "Possible" ? "RR variability above threshold — further evaluation recommended." :
                 afibFlag === "Low" ? "RR variability within expected range." :
                 "Insufficient beat data to estimate."}
              </p>
            </div>

            {/* SNR */}
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">SNR (Signal-to-Noise Ratio)</p>
              <p className="mono-data">{quality.snrDb !== null ? `${quality.snrDb.toFixed(1)} dB` : "--"}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {quality.snrDb === null ? "No signal loaded." :
                 quality.snrDb >= 20 ? "Excellent SNR — very clean signal with minimal noise." :
                 quality.snrDb >= 15 ? "Good SNR — suitable for reliable analysis." :
                 quality.snrDb >= 8 ? "Moderate SNR — some noise present; results may vary slightly." :
                 "Poor SNR — significant noise contamination; re-record if possible."}
              </p>
            </div>

            {/* Baseline */}
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Baseline Wander</p>
              <p className={`mono-data ${quality.baseline === "High drift" ? "text-rose-400" : quality.baseline === "Mild drift" ? "text-amber-400" : ""}`}>
                {quality.baseline}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {quality.baseline === "Stable" ? "Baseline is steady — no significant DC offset detected." :
                 quality.baseline === "Mild drift" ? "Minor baseline drift — often caused by movement or electrode contact." :
                 quality.baseline === "High drift" ? "Large baseline drift — may obscure P and T waves. Check electrode placement." :
                 "Awaiting signal."}
              </p>
            </div>

            {/* Amplitude */}
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Peak-to-Peak Amplitude</p>
              <p className="mono-data">{quality.amplitude !== null ? quality.amplitude.toFixed(3) + " mV" : "--"}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {quality.amplitude === null ? "No amplitude measured." :
                 quality.amplitude >= 0.55 ? "Strong QRS amplitude — sensor contact is good." :
                 quality.amplitude >= 0.25 ? "Moderate amplitude — acceptable for analysis." :
                 "Weak amplitude — check sensor placement or skin preparation."}
              </p>
            </div>
          </div>
        </Panel>

        {/* AI Result */}
        <Panel title="AI Arrhythmia Analysis">
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
                <p className="text-xs uppercase tracking-wide text-slate-500">Classification</p>
                <p className="mono-data text-base mt-0.5">
                  {classMeta?.full ?? prediction.predictionLabel ?? prediction.arrhythmiaType ?? "--"}
                </p>
              </div>

              {/* Confidence bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Model Confidence</p>
                  <p className="mono-data text-lg">{confidencePct !== null ? `${confidencePct}%` : "--"}</p>
                </div>
                <div className="quality-bar-track">
                  <div
                    className="quality-bar-fill"
                    style={{ width: confidencePct !== null ? `${confidencePct}%` : "0%", background: `linear-gradient(90deg, ${confidenceBarColor}, ${confidenceBarColor}aa)` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {confidencePct !== null && confidencePct >= 85 ? "Model is highly confident in this result." :
                   confidencePct !== null && confidencePct >= 65 ? "Moderate confidence — consider clinical correlation." :
                   confidencePct !== null ? "Low confidence — signal quality or morphology may be atypical." :
                   ""}
                </p>
              </div>

              {/* Risk score */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Risk Score</p>
                  <p className="mono-data text-lg">
                    {typeof prediction.riskScore === "number" ? prediction.riskScore.toFixed(2) + " / 1.0" : "--"}
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

              {/* Per-class probability breakdown */}
              {probabilities && probabilities.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Class Probability Breakdown</p>
                  <div className="space-y-1.5">
                    {probabilities.map((p, idx) => {
                      const label = ARRHYTHMIA_CLASS_LABELS[idx];
                      const pct = Math.round(p * 100);
                      return (
                        <div key={idx} className="prob-bar">
                          <span className="w-20 shrink-0 text-slate-400">{label?.short ?? `Class ${idx}`}</span>
                          <div className="prob-bar-track">
                            <div
                              className="prob-bar-fill"
                              style={{
                                width: `${pct}%`,
                                background: prediction.classId === idx ? "#00d4ff" : "rgba(13,79,140,0.6)",
                              }}
                            />
                          </div>
                          <span className="w-9 text-right text-slate-300">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Model version */}
              {prediction.modelVersion && (
                <p className="text-xs text-slate-600">Model: {prediction.modelVersion}</p>
              )}

            </div>
          ) : (
            <div className="text-sm text-slate-400 space-y-2">
              <p>No prediction yet.</p>
              <p className="text-xs text-slate-500">Upload a CSV file and click <strong className="text-cyan-400">▶ Run AI Analysis</strong> to get arrhythmia classification, confidence scores, and clinical interpretation.</p>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Clinical Interpretation ──────────────────────────── */}
      {(prediction || uploadedSignal.length > 0) && (
        <Panel title="Clinical Interpretation" subtitle="Automated synthesis of signal and AI findings — not a substitute for professional medical advice">
          <div className={clinicalCardClass}>
            <p className="text-sm leading-relaxed text-slate-200">
              {prediction ? (
                <>
                  The AI model classified this ECG segment as{" "}
                  <strong className="text-cyan-300">{classMeta?.full ?? prediction.predictionLabel ?? "Unknown"}</strong>
                  {uploadedBpm ? (
                    <> with a mean heart rate of{" "}
                      <strong className={`${uploadedBpm < 50 ? "text-amber-400" : uploadedBpm > 100 ? "text-rose-400" : "text-cyan-300"}`}>
                        {uploadedBpm} bpm
                      </strong>
                    </>
                  ) : null}
                  {hrv.rmssd !== null ? (
                    <> and an HRV (RMSSD) of{" "}
                      <strong className={`${hrv.rmssd < 20 ? "text-rose-400" : hrv.rmssd < 50 ? "text-amber-400" : "text-emerald-400"}`}>
                        {hrv.rmssd.toFixed(1)} ms
                      </strong>
                    </>
                  ) : null}
                  .{" "}
                  {classMeta?.description ?? ""}
                  {rhythm.label !== "Insufficient data" ? (
                    <> Rhythm analysis shows a <strong className="text-slate-100">{rhythm.label.toLowerCase()}</strong> pattern
                    {rhythm.cv !== null ? ` (coefficient of variation: ${rhythm.cv.toFixed(1)}%)` : ""}.</>
                  ) : null}
                  {afibFlag === "Elevated" ? (
                    <> <strong className="text-rose-300">RR interval variability is elevated at a fast rate, which warrants clinical evaluation to exclude atrial fibrillation.</strong></>
                  ) : afibFlag === "Possible" ? (
                    <> RR variability is above the normal threshold — correlation with a 12-lead ECG is advised.</>
                  ) : null}
                </>
              ) : (
                uploadedSignal.length > 0 ? (
                  <>
                    Signal loaded: <strong className="text-cyan-300">{uploadedSignal.length.toLocaleString()} samples</strong> (~{durationSeconds}s at 360 Hz),{" "}
                    {peaks.length} beats detected, mean HR{" "}
                    <strong className="text-cyan-300">{uploadedBpm ?? "--"} bpm</strong>.{" "}
                    Click <strong className="text-cyan-400">▶ Run AI Analysis</strong> to generate the arrhythmia classification.
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

      {/* ── Key Measurements ─────────────────────────────────── */}
      <Panel title="Key Measurements" subtitle="Derived signal statistics from the last 1-second window">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {[
            {
              label: "Signal Mean",
              value: uploadedSignal.length ? (uploadedSignal.slice(-360).reduce((a, b) => a + b, 0) / Math.min(360, uploadedSignal.length)).toFixed(4) : "--",
              hint: "Average amplitude value — ideally near 0 for a well-centred signal.",
            },
            {
              label: "Signal RMS",
              value: uploadedSignal.length
                ? Math.sqrt(uploadedSignal.slice(-360).reduce((a, b) => a + b * b, 0) / Math.min(360, uploadedSignal.length)).toFixed(4)
                : "--",
              hint: "Root mean square — represents overall energy of the signal.",
            },
            {
              label: "Peak-to-Peak",
              value: uploadedSignal.length
                ? (Math.max(...uploadedSignal.slice(-360)) - Math.min(...uploadedSignal.slice(-360))).toFixed(3) + " mV"
                : "--",
              hint: "Amplitude span between lowest and highest sample.",
            },
            {
              label: "Noise Estimate",
              value: quality.noise !== null ? quality.noise.toFixed(4) : "--",
              hint: "Sample-to-sample jitter — lower is better.",
            },
            {
              label: "Recording Duration",
              value: uploadedSignal.length ? `${durationSeconds}s` : "--",
              hint: "Total duration assuming 360 Hz sampling rate.",
            },
            {
              label: "Total Samples",
              value: uploadedSignal.length ? uploadedSignal.length.toLocaleString() : "--",
              hint: "Number of numeric data points parsed from the CSV.",
            },
            {
              label: "Beats Detected",
              value: peaks.length > 0 ? peaks.length.toString() : "--",
              hint: "R-peaks identified using adaptive thresholding (250 ms minimum gap).",
            },
            {
              label: "Mean RR Interval",
              value: rrIntervals.length
                ? `${Math.round(rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length)} ms`
                : "--",
              hint: "Average time between consecutive heartbeats.",
            },
          ].map(({ label, value, hint }) => (
            <article key={label} className="metric-card">
              <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mono-data mt-1 text-xl text-cyan-100">{value}</p>
              <p className="mt-1 text-xs text-slate-600">{hint}</p>
            </article>
          ))}
        </div>
      </Panel>

      {/* ── Advanced Charts Toggle ───────────────────────────── */}
      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => setShowAdvanced((prev) => !prev)}>
          {showAdvanced ? "Hide Advanced Charts" : "Show Advanced Statistical Charts"}
        </Button>
      </div>

      {showAdvanced && (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Amplitude Distribution" subtitle="Histogram of signal amplitude values">
            <NormalDistributionChart data={normalChartData} />
          </Panel>
          <Panel title="Beat Rate — Poisson Estimate" subtitle="Probability distribution of peak events per second">
            <PoissonChart data={poissonChartData} />
          </Panel>
          <Panel title="Rate vs Variability Correlation" subtitle="Each point = 30-sample window chunk; x=rate proxy, y=variability">
            <CorrelationPlot data={correlationData} />
          </Panel>
        </div>
      )}
    </div>
  );
}
