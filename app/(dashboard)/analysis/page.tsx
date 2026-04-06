"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { LiveECGChart } from "@/components/charts/LiveECGChart";
import { NormalDistributionChart, PoissonChart } from "@/components/charts/DistributionChart";
import { CorrelationPlot } from "@/components/charts/CorrelationPlot";
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
      const idx = Math.min(bins - 1, Math.max(0, raw));
      counts[idx] += 1;
    }

    return counts.map((count, i) => ({
      x: Number((min + width * (i + 0.5)).toFixed(3)),
      p: Number((count / n).toFixed(4)),
    }));
  }, [uploadedSignal]);

  const poissonChartData = useMemo(() => {
    if (uploadedSignal.length < 12) return [] as Array<{ k: number; p: number }>;

    const window = uploadedSignal.slice(-360);
    const mean = window.reduce((a, b) => a + b, 0) / Math.max(1, window.length);
    const max = Math.max(...window);
    const threshold = mean + 0.25 * Math.max(max - mean, 0.01);

    let peaks = 0;
    for (let i = 1; i < window.length - 1; i++) {
      if (window[i] > window[i - 1] && window[i] >= window[i + 1] && window[i] > threshold) {
        peaks += 1;
      }
    }

    const seconds = window.length / 360;
    const lambda = Math.max(0.05, peaks / Math.max(seconds, 1e-6));
    const kMax = Math.max(4, Math.min(10, Math.ceil(lambda + 3 * Math.sqrt(lambda))));

    const fact = (n: number): number => {
      let result = 1;
      for (let i = 2; i <= n; i++) result *= i;
      return result;
    };

    const points: Array<{ k: number; p: number }> = [];
    for (let k = 0; k <= kMax; k++) {
      const p = (Math.exp(-lambda) * lambda ** k) / fact(k);
      points.push({ k, p: Number(p.toFixed(4)) });
    }

    return points;
  }, [uploadedSignal]);

  const correlationData = useMemo(() => {
    if (uploadedSignal.length < 60) return [] as Array<{ x: number; y: number }>;

    const window = uploadedSignal.slice(-360);
    const chunkSize = 30;
    const points: Array<{ x: number; y: number }> = [];

    for (let start = 0; start + chunkSize <= window.length; start += chunkSize) {
      const chunk = window.slice(start, start + chunkSize);
      const chunkMean = chunk.reduce((a, b) => a + b, 0) / chunk.length;
      const chunkMax = Math.max(...chunk);
      const threshold = chunkMean + 0.25 * Math.max(chunkMax - chunkMean, 0.01);

      let peaks = 0;
      for (let i = 1; i < chunk.length - 1; i++) {
        if (chunk[i] > chunk[i - 1] && chunk[i] >= chunk[i + 1] && chunk[i] > threshold) {
          peaks += 1;
        }
      }

      const seconds = chunk.length / 360;
      const bpmProxy = (peaks / Math.max(seconds, 1e-6)) * 60;
      const variance = chunk.reduce((acc, value) => acc + (value - chunkMean) ** 2, 0) / chunk.length;
      const variability = Math.sqrt(variance) * 1000;

      points.push({
        x: Number(bpmProxy.toFixed(1)),
        y: Number(variability.toFixed(1)),
      });
    }

    return points;
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
          <div className="space-y-3 text-sm text-slate-300">
            <div>
              <p>Estimated BPM: <span className="mono-data">{uploadedBpm ?? "--"}</span></p>
              <p className="text-xs text-slate-400">{uploadedBpm == null ? "Need more data to estimate heart rate." : uploadedBpm < 50 ? "Heart rate looks slow." : uploadedBpm > 110 ? "Heart rate looks fast." : "Heart rate is in a normal range."}</p>
            </div>
            <div>
              <p>SNR: <span className="mono-data">{quality.snrDb == null ? "--" : `${quality.snrDb.toFixed(1)} dB`}</span></p>
              <p className="text-xs text-slate-400">{quality.snrDb == null ? "No signal quality score yet." : quality.snrDb >= 15 ? "Signal is clean." : quality.snrDb >= 8 ? "Signal is usable but a bit noisy." : "Signal is noisy; result confidence may drop."}</p>
            </div>
            <div>
              <p>Baseline Wander: <span className="mono-data">{quality.baseline}</span></p>
              <p className="text-xs text-slate-400">{quality.baseline === "Stable" ? "Baseline looks steady." : quality.baseline === "Mild drift" ? "Small baseline drift is present." : "Large baseline drift detected."}</p>
            </div>
            <div>
              <p>Noise Level: <span className="mono-data">{quality.noise == null ? "--" : quality.noise.toFixed(4)}</span></p>
              <p className="text-xs text-slate-400">Lower is better. This is a rough beat-to-beat noise estimate.</p>
            </div>
            <div>
              <p>Peak-to-Peak: <span className="mono-data">{quality.amplitude == null ? "--" : quality.amplitude.toFixed(3)}</span></p>
              <p className="text-xs text-slate-400">{quality.amplitude == null ? "No amplitude value yet." : quality.amplitude >= 0.55 ? "Wave peaks are strong." : quality.amplitude >= 0.25 ? "Wave peaks are moderate." : "Wave peaks are low; check sensor contact."}</p>
            </div>
          </div>
        </Panel>
        <Panel title="AI Result">
          {prediction ? (
            <div className="space-y-3 text-sm text-slate-300">
              <div>
                <p>Prediction: <span className="mono-data">{prediction.predictionLabel ?? prediction.arrhythmiaType ?? "--"}</span></p>
                <p className="text-xs text-slate-400">Simple summary of what the model sees in this uploaded segment.</p>
              </div>
              <div>
                <p>Confidence: <span className="mono-data">{typeof prediction.confidence === "number" ? `${(prediction.confidence * 100).toFixed(1)}%` : "--"}</span></p>
                <p className="text-xs text-slate-400">Higher means the model is more sure.</p>
              </div>
              <div>
                <p>Risk: <span className="mono-data">{typeof prediction.riskScore === "number" ? prediction.riskScore.toFixed(1) : "--"}</span></p>
                <p className="text-xs text-slate-400">Closer to 1 means higher risk.</p>
              </div>
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

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Normal Distribution (Uploaded CSV)">
          <NormalDistributionChart data={normalChartData} />
        </Panel>
        <Panel title="Poisson Event Estimate (Uploaded CSV)">
          <PoissonChart data={poissonChartData} />
        </Panel>
        <Panel title="Correlation (Uploaded CSV)">
          <CorrelationPlot data={correlationData} />
        </Panel>
      </div>
    </div>
  );
}
