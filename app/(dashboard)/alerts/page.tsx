"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const initial = [
  { id: 1, ts: "10:12:04", type: "Tachycardia", bpm: 124, severity: "critical", ack: false },
  { id: 2, ts: "09:43:31", type: "PVC burst", bpm: 109, severity: "warning", ack: false },
  { id: 3, ts: "09:01:12", type: "Irregular rhythm", bpm: 98, severity: "info", ack: true },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(initial);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Panel title="Alert Feed" subtitle="Chronological incident stream">
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className="rounded-lg border border-slate-700 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-200">{a.type}</p>
                  <p className="text-xs text-slate-400">{a.ts} | BPM: {a.bpm}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={a.severity === "critical" ? "danger" : a.severity === "warning" ? "warning" : "info"}>
                    {a.severity}
                  </Badge>
                  {!a.ack && (
                    <Button
                      variant="ghost"
                      onClick={() => setAlerts((s) => s.map((x) => (x.id === a.id ? { ...x, ack: true } : x)))}
                    >
                      Acknowledge
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Alert Settings">
        <div className="grid gap-3 text-sm text-slate-300">
          <label>
            BPM High
            <input type="number" className="mt-1 w-full rounded-lg border border-slate-700 bg-[#041a2e] px-3 py-2" defaultValue={120} />
          </label>
          <label>
            BPM Low
            <input type="number" className="mt-1 w-full rounded-lg border border-slate-700 bg-[#041a2e] px-3 py-2" defaultValue={50} />
          </label>
          <label>
            SpO2 Low
            <input type="number" className="mt-1 w-full rounded-lg border border-slate-700 bg-[#041a2e] px-3 py-2" defaultValue={92} />
          </label>
          <Button>Save Preferences</Button>
        </div>
      </Panel>
    </div>
  );
}
