"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

import { useEffect } from "react";
import { api } from "@/lib/api";

export type ECGRecord = {
  _id: string;
  date: string;
  duration: number;
  bpm: number;
  prediction: string;
  risk: string;
};

export default function HistoryPage() {
  const [view, setView] = useState<"table" | "card">("table");
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<ECGRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/api/ecg/history")
      .then((res) => {
        const payload = res.data?.data;
        if (Array.isArray(payload)) {
          setRecords(payload);
          return;
        }
        setRecords(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, []);

  const pageData = useMemo(() => records.slice((page - 1) * 10, page * 10), [records, page]);

  return (
    <div className="space-y-4">
      <Panel title="History Summary">
        {loading ? (
          <div className="p-4 text-center text-slate-400">Loading records...</div>
        ) : records.length === 0 ? (
          <div className="p-4 text-center text-slate-400">No records found.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <p>Total recordings: <span className="mono-data">{records.length}</span></p>
            <p>Arrhythmia detected: <span className="mono-data">{records.filter(r => r.prediction !== "Normal").length}</span></p>
            <p>Avg BPM this month: <span className="mono-data">{
              (() => {
                const month = new Date().getMonth();
                const bpmRecords = records.filter(r => new Date(r.date).getMonth() === month);
                if (!bpmRecords.length) return "--";
                return Math.round(bpmRecords.reduce((sum, r) => sum + r.bpm, 0) / bpmRecords.length);
              })()
            }</span></p>
          </div>
        )}
      </Panel>

      <Panel title="Filters and Sort">
        <div className="grid gap-3 md:grid-cols-4">
          <input className="rounded-lg border border-slate-700 bg-[#041a2e] px-3 py-2" type="date" />
          <select className="rounded-lg border border-slate-700 bg-[#041a2e] px-3 py-2">
            <option>All predictions</option>
            <option>Normal</option>
            <option>PVC</option>
          </select>
          <select className="rounded-lg border border-slate-700 bg-[#041a2e] px-3 py-2">
            <option>All risks</option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
          <div className="flex gap-2">
            <Button variant={view === "table" ? "primary" : "ghost"} onClick={() => setView("table")}>Table</Button>
            <Button variant={view === "card" ? "primary" : "ghost"} onClick={() => setView("card")}>Card</Button>
          </div>
        </div>
      </Panel>

      <Panel title="Records">
        {loading ? (
          <div className="p-4 text-center text-slate-400">Loading records...</div>
        ) : records.length === 0 ? (
          <div className="p-4 text-center text-slate-400">No records found.</div>
        ) : view === "table" ? (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-300">
                  <th className="text-left">Date</th>
                  <th>Duration</th>
                  <th>BPM</th>
                  <th>Prediction</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((r) => (
                  <tr key={r._id} className="border-t border-slate-800 text-slate-300">
                    <td className="py-2">{r.date ? new Date(r.date).toLocaleString() : "--"}</td>
                    <td className="py-2 text-center">{r.duration}s</td>
                    <td className="py-2 text-center mono-data">{r.bpm}</td>
                    <td className="py-2 text-center">{r.prediction}</td>
                    <td className="py-2 text-center">
                      <Badge tone={r.risk === "High" ? "danger" : r.risk === "Medium" ? "warning" : "success"}>{r.risk}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pageData.map((r) => (
              <div key={r._id} className="rounded-lg border border-slate-700 p-3">
                <p className="text-sm text-slate-300">{r.date ? new Date(r.date).toLocaleString() : "--"}</p>
                <p className="mono-data text-xl">{r.bpm} BPM</p>
                <div className="h-6 ecg-line" />
              </div>
            ))}
          </div>
        )}
        {records.length > 0 && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
            <span className="text-sm text-slate-300">Page {page}</span>
            <Button variant="ghost" onClick={() => setPage((p) => Math.min(Math.ceil(records.length / 10), p + 1))}>Next</Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
