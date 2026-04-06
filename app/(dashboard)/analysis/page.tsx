"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { LiveECGChart } from "@/components/charts/LiveECGChart";
import { NormalDistributionChart, PoissonChart } from "@/components/charts/DistributionChart";
import { CorrelationPlot } from "@/components/charts/CorrelationPlot";
import { RegressionPlot } from "@/components/stats/RegressionPlot";
import { api } from "@/lib/api";

type LatestPrediction = {
  predictionLabel?: string;
  arrhythmiaType?: string;
  confidence?: number;
  riskScore?: number;
};

type UploadRecord = {
  _id: string;
  signal?: number[];
};

function parseCsvSignal(text: string): number[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const signal: number[] = [];

  for (const line of lines) {
    const cols = line.split(/[;,\s]+/).filter(Boolean);
    if (!cols.length) continue;

    let picked: number | null = null;
    for (const col of cols) {
      const value = Number(col);
      if (Number.isFinite(value)) {
        picked = value;
        break;
      }
    }

    if (picked != null) signal.push(picked);
  }

  return signal;
}

export default function AnalysisPage() {
  const [prediction, setPrediction] = useState<LatestPrediction | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [uploadedSignal, setUploadedSignal] = useState<number[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [statusText, setStatusText] = useState("Upload a CSV file and click Run Analysis.");
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleCsvSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPrediction(null);
    setErrorText(null);
    setStatusText("Parsing CSV...");
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
      setStatusText(`Loaded ${signal.length} samples from ${file.name}.`);
    } catch {
      setUploadedSignal([]);
      setStatusText("Unable to parse CSV.");
      setErrorText("Could not read this file. Use a plain CSV with numeric ECG samples.");
    }
  };

  const runAnalysis = async () => {
    if (uploadedSignal.length < 12 || isRunning) return;

    setIsRunning(true);
    setErrorText(null);
    setStatusText("Uploading ECG record...");

    try {
      const uploadRes = await api.post<UploadRecord>("/api/ecg/upload", {
        signal: uploadedSignal,
        duration_seconds: Math.max(1, Math.round(uploadedSignal.length / 360)),
        sampling_rate: 360,
      });

      const recordId = uploadRes.data?._id;
      if (!recordId) {
        throw new Error("Upload succeeded but no record ID returned.");
      }

      setStatusText("Running AI inference...");
      const analyzeRes = await api.post<LatestPrediction>(`/api/ecg/${recordId}/analyze`);
      setPrediction(analyzeRes.data ?? null);
      setStatusText("Analysis complete.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run analysis.";
      setStatusText("Analysis failed.");
      setErrorText(message);
    } finally {
      setIsRunning(false);
    }
  };

  const uploadedBpm = useMemo(() => {
    if (!uploadedSignal.length) return null;
    const seconds = uploadedSignal.length / 360;
    if (seconds <= 0) return null;

    const mean = uploadedSignal.reduce((a, b) => a + b, 0) / uploadedSignal.length;
    const max = Math.max(...uploadedSignal);
    const threshold = mean + 0.25 * Math.max(max - mean, 0.01);

    let peaks = 0;
    for (let i = 1; i < uploadedSignal.length - 1; i++) {
      if (uploadedSignal[i] > uploadedSignal[i - 1] && uploadedSignal[i] >= uploadedSignal[i + 1] && uploadedSignal[i] > threshold) {
        peaks += 1;
      }
    }

    const bpmEstimate = Math.round((peaks / seconds) * 60);
    return Number.isFinite(bpmEstimate) ? bpmEstimate : null;
  }, [uploadedSignal]);

  const quality = useMemo(() => {
    if (!uploadedSignal.length) {
      return { snrDb: null as number | null, baseline: "--", noise: null as number | null, amplitude: null as number | null };
    }

    const window = uploadedSignal.slice(-360);
    const n = window.length;
    if (!n) {
      return { snrDb: null as number | null, baseline: "--", noise: null as number | null, amplitude: null as number | null };
    }

    let mean = 0;
    for (const v of window) mean += v;
    mean /= n;

    let varSignal = 0;
    for (const v of window) {
      const d = v - mean;
      varSignal += d * d;
    }
    varSignal /= n;

    let diffSq = 0;
    for (let i = 1; i < window.length; i++) {
      const d = window[i] - window[i - 1];
      diffSq += d * d;
    }
    const noise = Math.sqrt(diffSq / Math.max(1, window.length - 1));
    const signalRms = Math.sqrt(Math.max(varSignal, 1e-9));
    const snrDb = 20 * Math.log10(Math.max(signalRms / Math.max(noise, 1e-6), 1e-6));

    const min = Math.min(...window);
    const max = Math.max(...window);
    const amplitude = max - min;

    const baseline = Math.abs(mean) < 0.05 ? "Stable" : Math.abs(mean) < 0.12 ? "Mild drift" : "High drift";
    return { snrDb, baseline, noise, amplitude };
  }, [uploadedSignal]);

  const featureSnapshot = useMemo(() => {
    if (!uploadedSignal.length) {
      return [
        ["R-peak density", "--"],
        ["Signal mean", "--"],
        ["Signal RMS", "--"],
        ["Peak-to-peak", "--"],
        ["Estimated BPM", "--"],
        ["SNR", "--"],
      ];
    }

    const window = uploadedSignal.slice(-360);
    const n = window.length;
    const mean = window.reduce((a, b) => a + b, 0) / Math.max(1, n);
    const rms = Math.sqrt(window.reduce((a, b) => a + b * b, 0) / Math.max(1, n));
    const min = Math.min(...window);
    const max = Math.max(...window);
    const p2p = max - min;

    let peaks = 0;
    for (let i = 1; i < window.length - 1; i++) {
      if (window[i] > window[i - 1] && window[i] >= window[i + 1] && window[i] > mean + 0.25 * Math.max(quality.amplitude ?? 0, 0.01)) {
        peaks += 1;
      }
    }
    const peakDensity = peaks / Math.max(1, window.length);

    return [
      ["R-peak density", peakDensity.toFixed(3)],
      ["Signal mean", mean.toFixed(4)],
      ["Signal RMS", rms.toFixed(4)],
      ["Peak-to-peak", p2p.toFixed(4)],
      ["Estimated BPM", uploadedBpm != null && uploadedBpm > 0 ? String(uploadedBpm) : "--"],
      ["SNR", quality.snrDb == null ? "--" : `${quality.snrDb.toFixed(1)} dB`],
    ];
  }, [uploadedSignal, uploadedBpm, quality.amplitude, quality.snrDb]);

  const analysisInsights = useMemo(() => {
    const snr = quality.snrDb;
    const amplitude = quality.amplitude;
    const bpm = uploadedBpm;

    const bpmState =
      bpm == null ? "No estimate" : bpm < 50 || bpm > 110 ? "Out of expected range" : bpm < 60 || bpm > 100 ? "Borderline" : "Within expected range";
    const bpmDetail =
      bpm == null
        ? "Upload a clearer or longer signal to estimate heart rate."
        : bpm < 50
          ? "Bradycardic trend detected. Consider checking lead placement and symptoms."
          : bpm > 110
            ? "Tachycardic trend detected. Verify rhythm quality and repeat capture if needed."
            : "Heart rate estimate appears stable for this segment.";

    const snrState = snr == null ? "Unknown" : snr >= 15 ? "Clean signal" : snr >= 8 ? "Moderate noise" : "High noise";
    const snrDetail =
      snr == null
        ? "SNR will appear after a valid upload."
        : snr >= 15
          ? "Waveform is clear enough for reliable morphology interpretation."
          : snr >= 8
            ? "Signal is usable but noisy. Re-capturing may improve confidence."
            : "Noise is high and may affect prediction reliability.";

    const ampState = amplitude == null ? "Unknown" : amplitude >= 0.55 ? "Strong morphology" : amplitude >= 0.25 ? "Moderate morphology" : "Low morphology";
    const ampDetail =
      amplitude == null
        ? "Peak-to-peak amplitude appears after upload."
        : amplitude >= 0.55
          ? "Distinct peaks are present, which helps R-peak detection."
          : amplitude >= 0.25
            ? "Beat shape is visible but may benefit from better electrode contact."
            : "Low waveform amplitude detected. Check sensor contact and baseline drift.";

    const baselineState = quality.baseline === "Stable" ? "Good baseline" : quality.baseline === "Mild drift" ? "Watch baseline" : "Baseline issue";
    const baselineDetail =
      quality.baseline === "Stable"
        ? "Minimal baseline wander."
        : quality.baseline === "Mild drift"
          ? "Some baseline movement is present; filtering may help."
          : "Large baseline drift may distort ST/T interpretation.";

    return [
      {
        title: "Heart Rate Interpretation",
        value: bpm == null ? "--" : `${bpm} bpm`,
        state: bpmState,
        detail: bpmDetail,
      },
      {
        title: "Signal Quality (SNR)",
        value: snr == null ? "--" : `${snr.toFixed(1)} dB`,
        state: snrState,
        detail: snrDetail,
      },
      {
        title: "Morphology Amplitude",
        value: amplitude == null ? "--" : amplitude.toFixed(3),
        state: ampState,
        detail: ampDetail,
      },
      {
        title: "Baseline Stability",
        value: quality.baseline,
        state: baselineState,
        detail: baselineDetail,
      },
    ];
  }, [quality.amplitude, quality.baseline, quality.snrDb, uploadedBpm]);

  return (
    <div className="space-y-4">
      <Panel title="ECG Analysis Workbench" subtitle="CSV-only workflow for upload and AI analysis">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="rounded-xl border border-dashed border-cyan-500/50 bg-[#041a2e] p-5 text-sm text-slate-300">
            Upload ECG CSV file
            <input className="mt-3 block text-xs" type="file" accept=".csv,text/csv" onChange={handleCsvSelection} />
            <p className="mt-2 text-xs text-slate-400">Reads numeric samples from CSV rows and analyzes the uploaded signal only.</p>
          </label>
          <div className="flex flex-col justify-end gap-2">
            <Button onClick={() => void runAnalysis()} disabled={uploadedSignal.length < 12 || isRunning}>
              {isRunning ? "Running Analysis..." : "Run Analysis"}
            </Button>
            <p className="text-xs text-slate-400">{selectedFileName ? `Selected: ${selectedFileName}` : "No file selected"}</p>
            <p className="text-xs text-slate-400">{statusText}</p>
            {errorText ? <p className="text-xs text-rose-300">{errorText}</p> : null}
          </div>
        </div>
      </Panel>

      <Panel title="Waveform Viewer" subtitle="Uploaded ECG signal preview">
        <LiveECGChart points={uploadedSignal} />
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Signal Quality (Uploaded CSV)">
          <p className="text-sm text-slate-300">Estimated BPM: <span className="mono-data">{uploadedBpm ?? "--"}</span></p>
          <p className="text-sm text-slate-300">SNR: <span className="mono-data">{quality.snrDb == null ? "--" : `${quality.snrDb.toFixed(1)} dB`}</span></p>
          <p className="text-sm text-slate-300">Baseline Wander: <span className="mono-data">{quality.baseline}</span></p>
          <p className="text-sm text-slate-300">Noise Level: <span className="mono-data">{quality.noise == null ? "--" : quality.noise.toFixed(4)}</span></p>
          <p className="text-sm text-slate-300">Peak-to-Peak: <span className="mono-data">{quality.amplitude == null ? "--" : quality.amplitude.toFixed(3)}</span></p>
        </Panel>
        <Panel title="AI Result">
          {prediction ? (
            <div className="space-y-1 text-sm text-slate-300">
              <p>Prediction: <span className="mono-data">{prediction.predictionLabel ?? prediction.arrhythmiaType ?? "--"}</span></p>
              <p>Confidence: <span className="mono-data">{typeof prediction.confidence === "number" ? `${(prediction.confidence * 100).toFixed(1)}%` : "--"}</span></p>
              <p>Risk: <span className="mono-data">{typeof prediction.riskScore === "number" ? prediction.riskScore.toFixed(1) : "--"}</span></p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No prediction yet. Upload a CSV and click Run Analysis.</p>
          )}
        </Panel>
      </div>

      <Panel title="Feature Snapshot (Uploaded Signal)">
        <div className="grid gap-2 md:grid-cols-3">
          {featureSnapshot.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">
              <p className="text-slate-300">{k}</p>
              <p className="mono-data text-xl">{v}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Analysis Interpretation" subtitle="What the uploaded signal metrics indicate">
        <div className="grid gap-3 md:grid-cols-2">
          {analysisInsights.map((insight) => (
            <article key={insight.title} className="rounded-xl border border-slate-700 bg-[#051a2d] px-4 py-3">
              <p className="text-sm text-cyan-200">{insight.title}</p>
              <p className="mono-data mt-1 text-2xl">{insight.value}</p>
              <p className="mt-1 text-xs text-amber-200">{insight.state}</p>
              <p className="mt-2 text-sm text-slate-300">{insight.detail}</p>
            </article>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Normal Distribution Overlay">
          <NormalDistributionChart />
        </Panel>
        <Panel title="Poisson PVC Frequency">
          <PoissonChart />
        </Panel>
        <Panel title="Karl Pearson Correlation">
          <CorrelationPlot />
        </Panel>
        <Panel title="Regression Trend + R²">
          <RegressionPlot />
        </Panel>
      </div>
    </div>
  );
}
