"use client";


import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";
import { LiveECGChart } from "@/components/charts/LiveECGChart";
import { RiskGauge } from "@/components/charts/RiskGauge";
import { HeartRateTrend, HRVBarChart } from "@/components/charts/HRVChart";
import { useCardioStore } from "@/lib/store";
import { useAuth } from "@/lib/useAuth";
import { useEffect, useRef, useState } from "react";

type HistoryWindow = {
  label: string;
  status: string;
};

type DashboardProfile = {
  name?: string;
  dob?: string;
  bloodGroup?: string;
  conditions?: string[];
  hrv?: number | null;
  deviceStatus?: string;
  signalStrength?: number | null;
  battery?: number | null;
  latestBpm?: number | null;
  prediction?: string | null;
  riskScore?: number | null;
  insights?: string[];
  ecgHistory?: HistoryWindow[];
};

export default function DashboardPage() {
  useAuth();
  const bpm = useCardioStore((s) => s.bpm);
  const ecg = useCardioStore((s) => s.ecgBuffer);
  const pushECG = useCardioStore((s) => s.pushECG);
  const setBpm = useCardioStore((s) => s.setBpm);
  const clearLiveData = useCardioStore((s) => s.clearLiveData);
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const lastLiveTsRef = useRef<number>(0);
  const lastChunkAtRef = useRef<number>(0);

  useEffect(() => {
    let alive = true;

    const refreshProfile = async () => {
      const res = await fetch("/api/user/profile", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!alive) return;

      const nextProfile = data?.data || null;
      setProfile(nextProfile);
      setLoading(false);

      if (nextProfile?.deviceStatus !== "ESP32 Connected") {
        lastLiveTsRef.current = 0;
        lastChunkAtRef.current = 0;
        clearLiveData();
      }
    };

    void refreshProfile();
    const timer = setInterval(() => {
      void refreshProfile();
    }, 5000);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [clearLiveData]);

  useEffect(() => {
    let alive = true;
    let inFlight = false;

    const poll = async () => {
      if (!alive || inFlight) return;
      inFlight = true;
      try {
        const url = `/api/ecg/live?after_ts=${lastLiveTsRef.current}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;

        const payload = await res.json();
        const chunks = Array.isArray(payload?.chunks) ? payload.chunks : [];
        for (const c of chunks) {
          if (Array.isArray(c.signal) && c.signal.length) {
            pushECG(c.signal);
            lastChunkAtRef.current = Date.now();
          }
          if (typeof c.bpm === "number" && c.bpm > 0) {
            setBpm(c.bpm);
          }
          if (typeof c.ts === "number" && c.ts > lastLiveTsRef.current) {
            lastLiveTsRef.current = c.ts;
          }
        }

        if (typeof payload?.latest_ts === "number" && payload.latest_ts > lastLiveTsRef.current) {
          lastLiveTsRef.current = payload.latest_ts;
        }
      } finally {
        inFlight = false;
      }
    };

    const timer = setInterval(() => {
      void poll();
    }, 700);
    void poll();

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pushECG, setBpm]);

  // Show loading or empty state for new users
  if (loading) return <div className="p-8 text-center text-slate-400">Loading dashboard...</div>;

  const displayBpm = bpm > 0 ? bpm : profile?.latestBpm ?? null;
  const displayPrediction = profile?.prediction ?? "No prediction yet";
  const hasPrediction = typeof profile?.riskScore === "number";
  const isDeviceOnline = profile?.deviceStatus === "ESP32 Connected";
  const hasFreshChunk = Date.now() - lastChunkAtRef.current <= 4000;
  const hasLiveEcg = isDeviceOnline && hasFreshChunk && ecg.length > 10;
  const liveEcgPoints = hasLiveEcg ? ecg : [];
  const hasHistory = typeof profile?.latestBpm === "number";

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr_320px]">
      <div className="grid gap-4">
        <Panel title="Patient Profile">
          <div className="space-y-1 text-sm text-slate-300">
            <p className="glow-text text-3xl">{profile?.name || <span className="text-slate-500">No name set</span>}</p>
            <p>
              Age: {profile?.dob ? getAge(profile.dob) : <span className="text-slate-500">--</span>} |
              Blood Group: {profile?.bloodGroup || <span className="text-slate-500">--</span>}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {profile?.conditions?.length
                ? profile.conditions.map((c: string) => <Badge key={c} tone="warning">{c}</Badge>)
                : <span className="text-slate-500">No conditions</span>}
            </div>
          </div>
        </Panel>
        <Panel title="Heart Rate">
          <p className="glow-text text-4xl">{displayBpm ?? '--'} BPM</p>
          <p className="text-xs text-slate-400">Normal range 60-100</p>
        </Panel>
        <Panel title="HRV">
          <p className="glow-text text-3xl">{profile?.hrv || '--'} ms</p>
          <HRVBarChart />
        </Panel>
        <Panel title="Device Status">
          <div className="flex items-center gap-2 text-emerald-300">
            <span className="pulse-dot" /> {profile?.deviceStatus || 'No device connected'}
          </div>
          <p className="mt-2 text-xs text-slate-400">Signal {profile?.signalStrength ?? '--'}% | Battery {profile?.battery ?? '--'}%</p>
        </Panel>
      </div>

      <div className="grid gap-4">
        <Panel
          title="Live ECG Stream"
          subtitle={hasLiveEcg ? "Recording..." : "Waiting for device stream"}
          right={hasLiveEcg ? <Badge tone="danger">REC</Badge> : <Badge tone="info">IDLE</Badge>}
        >
          <LiveECGChart points={liveEcgPoints} />
        </Panel>
        <Panel title="ECG History">
          <div className="grid gap-2 text-sm">
            {profile?.ecgHistory?.length ? profile.ecgHistory.map((h) => (
              <div key={h.label} className="rounded-lg border border-slate-700/70 p-2 text-slate-300">
                <div className="flex items-center justify-between">
                  <span>{h.label} Capture Window</span>
                  <Badge tone="info">{h.status}</Badge>
                </div>
                <div className="mt-1 h-6 ecg-line" />
              </div>
            )) : <span className="text-slate-500">No ECG history</span>}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4">
        <Panel title="Arrhythmia Prediction">
          <RiskGauge value={hasPrediction ? profile.riskScore : 0} />
          <p className="text-center text-sm text-slate-300">Prediction: {displayPrediction}</p>
        </Panel>
        <Panel title="AI Insights">
          <div className="space-y-2 text-sm">
            {profile?.insights?.length
              ? profile.insights.map((i: string) => (
                  <div key={i} className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-rose-200">{i}</div>
                ))
              : <span className="text-slate-500">No insights yet</span>}
          </div>
        </Panel>
        <Panel title="Heart Rate Trend">
          {hasHistory ? (
            <HeartRateTrend />
          ) : (
            <p className="text-sm text-slate-400">No trend yet. Start streaming ECG to build heart-rate trends.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function getAge(dob: string) {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return '--';
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}
