"use client";

import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";

export default function ReportsPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Panel title="Generate Report">
        <div className="grid gap-3 text-sm text-slate-300">
          <input type="date" className="rounded-lg border border-slate-700 bg-[#041a2e] px-3 py-2" />
          <input type="date" className="rounded-lg border border-slate-700 bg-[#041a2e] px-3 py-2" />
          <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> ECG Waveform</label>
          <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> AI Prediction</label>
          <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Statistical Summary</label>
          <Button>Generate PDF</Button>
        </div>
      </Panel>
      <Panel title="Report Preview">
        <div className="rounded-lg border border-slate-700 bg-[#031424] p-3 text-sm text-slate-300">
          <p className="font-semibold text-cyan-200">CardioSense Clinical Summary</p>
          <p>Patient: Noopur Sharma</p>
          <p>Prediction: Normal rhythm with occasional PVC episodes</p>
          <div className="my-2 h-6 ecg-line" />
          <p>Doctor notes: ...</p>
        </div>
      </Panel>
      <Panel title="Generated Reports" className="lg:col-span-2">
        <div className="space-y-2 text-sm">
          {["Week 12 Review", "Monthly Risk Summary", "Pre-Exam Monitoring"].map((r) => (
            <div key={r} className="flex items-center justify-between rounded-lg border border-slate-700 p-2 text-slate-300">
              <span>{r}</span>
              <Button variant="ghost">Download</Button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
