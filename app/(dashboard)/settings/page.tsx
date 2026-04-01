"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";

export default function SettingsPage() {
  const [accent, setAccent] = useState<"cyan" | "purple" | "green">("cyan");

  const applyAccent = (a: "cyan" | "purple" | "green") => {
    setAccent(a);
    const root = document.documentElement;
    if (a === "cyan") root.style.setProperty("--accent", "#00d4ff");
    if (a === "purple") root.style.setProperty("--accent", "#8b5cf6");
    if (a === "green") root.style.setProperty("--accent", "#00ff88");
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Dashboard Preferences">
        <div className="grid gap-3 text-sm text-slate-300">
          <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Dense layout mode</label>
          <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Show AI insight popups</label>
          <label className="flex items-center gap-2"><input type="checkbox" /> Imperial units</label>
        </div>
      </Panel>
      <Panel title="Theme Accent">
        <div className="flex gap-2">
          <Button variant={accent === "cyan" ? "primary" : "ghost"} onClick={() => applyAccent("cyan")}>Cyan</Button>
          <Button variant={accent === "purple" ? "primary" : "ghost"} onClick={() => applyAccent("purple")}>Purple</Button>
          <Button variant={accent === "green" ? "primary" : "ghost"} onClick={() => applyAccent("green")}>Green</Button>
        </div>
      </Panel>
      <Panel title="Thresholds">
        <div className="grid gap-3 text-sm text-slate-300">
          <label>BPM High<input className="mt-1 w-full rounded border border-slate-700 bg-[#041a2e] px-3 py-2" defaultValue={120} /></label>
          <label>BPM Low<input className="mt-1 w-full rounded border border-slate-700 bg-[#041a2e] px-3 py-2" defaultValue={50} /></label>
          <label>SpO2 Low<input className="mt-1 w-full rounded border border-slate-700 bg-[#041a2e] px-3 py-2" defaultValue={92} /></label>
          <Button>Save Thresholds</Button>
        </div>
      </Panel>
      <Panel title="Data and API">
        <p className="text-sm text-slate-300">Retention: 180 days</p>
        <p className="mono-data mt-2">API Key: cs_live_2f9f....e91</p>
      </Panel>
    </div>
  );
}
