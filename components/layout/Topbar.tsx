"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { useCardioStore } from "@/lib/store";

interface ProfileData {
  name?: string;
  deviceStatus?: string;
}

export function Topbar() {
  const router = useRouter();
  const bpm = useCardioStore((s) => s.bpm);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.data) setProfile(data.data);
        else if (data && !data.error) setProfile(data);
      })
      .catch(() => {});
  }, []);

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  };

  const isDeviceOnline = profile?.deviceStatus === "ESP32 Connected";

  return (
    <header className="cardio-panel mb-4 flex items-center justify-between p-3">
      <div>
        <h2 className="font-[var(--display)] text-xl text-cyan-300">CardioSense Telemetry</h2>
        {profile?.name ? (
          <p className="text-xs text-slate-400">
            Welcome back, <span className="text-cyan-300">{profile.name}</span>
          </p>
        ) : (
          <p className="text-xs text-slate-400">Where AI Meets Every Heartbeat</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* BPM Badge */}
        <Badge tone={bpm > 0 ? "success" : "info"}>
          <span className={`pulse-dot ${bpm > 0 ? "text-emerald-300" : "text-cyan-300"}`} />
          {bpm > 0 ? `${bpm} BPM` : "No signal"}
        </Badge>

        {/* Device status badge */}
        <Badge tone={isDeviceOnline ? "success" : "info"}>
          <span className={`pulse-dot ${isDeviceOnline ? "text-emerald-300" : "text-slate-400"}`} />
          {profile?.deviceStatus ?? "No device"}
        </Badge>

        {/* User menu */}
        <div className="relative">
          <button
            id="topbar-user-menu"
            onClick={() => setShowMenu((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-800/60 bg-cyan-900/30 text-sm text-cyan-200 hover:border-cyan-400/60 hover:bg-cyan-800/40 transition-all"
            aria-label="User menu"
          >
            {profile?.name?.[0]?.toUpperCase() ?? "?"}
          </button>

          {showMenu && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              {/* Dropdown */}
              <div className="absolute right-0 top-10 z-50 min-w-[160px] rounded-xl border border-slate-700/80 bg-[#071e35] py-1 shadow-xl">
                <p className="px-3 py-2 text-xs text-slate-400 border-b border-slate-700/50">
                  {profile?.name ?? "User"}
                </p>
                <button
                  onClick={handleSignOut}
                  className="w-full px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
