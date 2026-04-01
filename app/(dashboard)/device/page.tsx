"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { api } from "@/lib/api";

type Device = {
  _id: string;
  deviceIdStr: string;
  name: string;
  location?: string;
  firmwareVersion?: string;
  apiKey: string;
};

type DeviceStatus = {
  connected: boolean;
  heartbeat_age_ms: number;
  last_seen?: string;
  signal_strength: number;
  battery: number;
};

export default function DevicePage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const activeDevice = devices[0] ?? null;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/api/devices");
        const list = Array.isArray(res.data) ? res.data : [];
        setDevices(list);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!activeDevice?._id) {
      setStatus(null);
      return;
    }

    let timer: ReturnType<typeof setInterval> | undefined;
    const poll = async () => {
      try {
        const res = await api.get(`/api/devices/${activeDevice._id}/status`);
        setStatus(res.data ?? null);
      } catch {
        setStatus(null);
      }
    };

    void poll();
    timer = setInterval(() => {
      void poll();
    }, 5000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeDevice?._id]);

  const connected = Boolean(status?.connected);
  const heartbeatSec =
    typeof status?.heartbeat_age_ms === "number" && Number.isFinite(status.heartbeat_age_ms)
      ? Math.max(0, Math.round(status.heartbeat_age_ms / 1000))
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="ESP32 Auto Setup" subtitle="No manual registration required">
        <div className="space-y-2 text-sm text-slate-300">
          <p>
            Device onboarding is automatic. As soon as ESP32 sends heartbeat with
            <span className="mono-data"> enrollment_key</span>, backend provisions the device and returns
            <span className="mono-data"> api_key</span>.
          </p>
          <p>
            If no device appears, verify:
          </p>
          <p>1. ESP32 is connected to WiFi</p>
          <p>2. API_BASE is reachable from ESP32 network</p>
          <p>3. DEVICE_ENROLLMENT_KEY matches backend env</p>
        </div>
      </Panel>

      <Panel title="Connection Status">
        {loading ? (
          <p className="text-sm text-slate-400">Loading devices...</p>
        ) : !activeDevice ? (
          <p className="text-sm text-slate-400">No device registered yet.</p>
        ) : (
          <div className="space-y-2 text-sm text-slate-300">
            <p>
              Device: <span className="mono-data">{activeDevice.deviceIdStr}</span>
            </p>
            <p>
              API Key: <span className="mono-data">{activeDevice.apiKey}</span>
            </p>
            <p>
              <span className={`pulse-dot inline-block ${connected ? "text-emerald-300" : "text-slate-500"}`} />{" "}
              Status: <span className="mono-data">{connected ? "Connected" : "Offline"}</span>
            </p>
            <p>
              Last heartbeat: <span className="mono-data">{heartbeatSec == null ? "--" : `${heartbeatSec}s ago`}</span>
            </p>
            <p>
              Signal: <span className="mono-data">{status?.signal_strength ?? 0}%</span> | Battery: <span className="mono-data">{status?.battery ?? 0}%</span>
            </p>
            <p>
              Firmware: <span className="mono-data">{activeDevice.firmwareVersion ?? "--"}</span>
            </p>
          </div>
        )}
      </Panel>

      <Panel title="Sensor Calibration">
        <div className="grid gap-2 text-sm text-slate-300">
          <label>
            Baseline
            <input type="range" className="w-full" />
          </label>
          <label>
            Gain
            <input type="range" className="w-full" />
          </label>
        </div>
      </Panel>

      <Panel title="ESP32 Notes" subtitle="Start with heartbeat + sensor chunks">
        <div className="space-y-2 text-xs text-slate-300">
          <p>1. Send heartbeat to <span className="mono-data">/api/devices/heartbeat</span> every 5s.</p>
          <p>2. Set <span className="mono-data">sensor_connected=true</span> only when sensor wire is attached.</p>
          <p>3. Send ECG chunks of exactly <span className="mono-data">60 samples</span> to <span className="mono-data">/api/sensor/data</span>.</p>
          <p>4. For zero-touch onboarding, set <span className="mono-data">AUTO_PROVISION_USER_EMAIL</span> and <span className="mono-data">DEVICE_ENROLLMENT_KEY</span> in backend env.</p>
        </div>
      </Panel>
    </div>
  );
}
