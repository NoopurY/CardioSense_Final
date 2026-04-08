"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";

type HistoryItem = {
  label: string;
  status: string;
};

type ProfileData = {
  name?: string;
  dob?: string;
  bloodGroup?: string;
  gender?: string;
  avatarUrl?: string;
  conditions?: string[];
  deviceStatus?: string;
  signalStrength?: number | null;
  battery?: number | null;
  latestBpm?: number | null;
  riskScore?: number | null;
  prediction?: string | null;
  ecgHistory?: HistoryItem[];
  insights?: string[];
};

function scoreTone(score: number | null | undefined) {
  if (typeof score !== "number") return "text-slate-300";
  if (score >= 70) return "text-rose-300";
  if (score >= 40) return "text-amber-300";
  return "text-emerald-300";
}

function statusTone(status: string | undefined) {
  const value = (status ?? "").toLowerCase();
  if (value.includes("connected") || value.includes("normal")) return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  if (value.includes("critical") || value.includes("offline") || value.includes("high")) return "bg-rose-500/10 text-rose-300 border-rose-500/30";
  if (value.includes("watch") || value.includes("medium")) return "bg-amber-500/10 text-amber-300 border-amber-500/30";
  return "bg-slate-700/40 text-slate-300 border-slate-600/50";
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setErrorText(null);
        const response = await fetch("/api/user/profile", { credentials: "include" });

        if (response.status === 401) {
          router.push("/auth/login");
          return;
        }
        if (!response.ok) {
          throw new Error("Unable to load profile information.");
        }

        const payload = (await response.json()) as { data?: ProfileData };
        if (active) {
          setProfile(payload.data ?? null);
        }
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Unable to load profile.";
        setErrorText(message);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, [router]);

  const initials = useMemo(() => {
    const name = profile?.name?.trim();
    if (!name) return "CS";
    const parts = name.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "CS";
  }, [profile?.name]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setErrorText(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout failed. Please try again.");
      }

      router.push("/auth/login");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Logout failed.";
      setErrorText(message);
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Panel>
          <div className="animate-pulse space-y-3">
            <div className="h-7 w-48 rounded bg-slate-700/50" />
            <div className="h-4 w-72 rounded bg-slate-700/40" />
          </div>
        </Panel>
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel><div className="h-40 animate-pulse rounded bg-slate-700/40" /></Panel>
          <Panel><div className="h-40 animate-pulse rounded bg-slate-700/40" /></Panel>
          <Panel><div className="h-40 animate-pulse rounded bg-slate-700/40" /></Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-[radial-gradient(80%_120%_at_5%_0%,rgba(34,211,238,0.2),rgba(15,23,42,0.75))] p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              {profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt="Profile avatar"
                  className="h-16 w-16 rounded-2xl border border-cyan-300/40 object-cover shadow-[0_0_24px_rgba(34,211,238,0.25)]"
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-cyan-300/40 bg-cyan-500/10 text-lg font-bold text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.25)]">
                  {initials}
                </div>
              )}
              <div>
                <h1 className="font-(--display) text-3xl text-cyan-200">Profile & Security</h1>
                <p className="text-sm text-slate-300">
                  Welcome, <span className="text-slate-100">{profile?.name ?? "CardioSense User"}</span>. Manage your account and monitor your health summary.
                </p>
              </div>
            </div>

            <Button variant="danger" onClick={() => void handleLogout()} disabled={loggingOut}>
              {loggingOut ? "Signing out..." : "Log out"}
            </Button>
          </div>
        </div>
      </Panel>

      {errorText ? (
        <Panel>
          <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{errorText}</p>
        </Panel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Personal Information" subtitle="Identity and basic demographic details">
          <div className="space-y-2 text-sm text-slate-300">
            <p><span className="text-slate-400">Name:</span> {profile?.name ?? "Not set"}</p>
            <p><span className="text-slate-400">Gender:</span> {profile?.gender ?? "Not set"}</p>
            <p><span className="text-slate-400">Date of Birth:</span> {profile?.dob ?? "Not set"}</p>
            <p><span className="text-slate-400">Blood Group:</span> {profile?.bloodGroup ?? "Not set"}</p>
          </div>
        </Panel>

        <Panel title="Current Health Snapshot" subtitle="Latest AI and telemetry indicators">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Latest BPM</span>
              <span className="font-semibold text-cyan-200">{profile?.latestBpm ?? "--"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Prediction</span>
              <span className="font-semibold text-slate-200">{profile?.prediction ?? "--"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Risk Score</span>
              <span className={`font-semibold ${scoreTone(profile?.riskScore)}`}>
                {typeof profile?.riskScore === "number" ? `${Math.round(profile.riskScore)}%` : "--"}
              </span>
            </div>
          </div>
        </Panel>

        <Panel title="Device & Signal" subtitle="ESP32 connection and telemetry">
          <div className="space-y-3 text-sm">
            <div className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${statusTone(profile?.deviceStatus)}`}>
              {profile?.deviceStatus ?? "Unknown"}
            </div>
            <p className="text-slate-300">
              <span className="text-slate-400">Signal Strength:</span>{" "}
              {typeof profile?.signalStrength === "number" ? `${profile.signalStrength}%` : "--"}
            </p>
            <p className="text-slate-300">
              <span className="text-slate-400">Battery:</span>{" "}
              {typeof profile?.battery === "number" ? `${profile.battery}%` : "--"}
            </p>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent Risk Windows" subtitle="AI assessment by time period">
          <div className="space-y-2 text-sm">
            {(profile?.ecgHistory?.length ?? 0) > 0 ? (
              profile?.ecgHistory?.map((item) => (
                <div key={`${item.label}-${item.status}`} className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-2">
                  <span className="text-slate-300">{item.label}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${statusTone(item.status)}`}>{item.status}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-400">No ECG history yet. Capture a reading to populate trend windows.</p>
            )}
          </div>
        </Panel>

        <Panel title="Clinical Insights" subtitle="Generated observations from latest records">
          <div className="space-y-2 text-sm text-slate-300">
            {(profile?.insights?.length ?? 0) > 0 ? (
              profile?.insights?.map((insight, idx) => (
                <p key={`${idx}-${insight}`} className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
                  {insight}
                </p>
              ))
            ) : (
              <p className="text-slate-400">No automated insights yet. Run analysis from the ECG Analysis page.</p>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Medical Conditions" subtitle="Stored history for context-aware monitoring">
        {(profile?.conditions?.length ?? 0) > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profile?.conditions?.map((condition) => (
              <span key={condition} className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
                {condition}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No conditions added yet.</p>
        )}
      </Panel>
    </div>
  );
}
