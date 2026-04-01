import { Panel } from "@/components/ui/Panel";

const endpoints = [
  ["POST", "/api/auth/signup", "Create account", "No"],
  ["POST", "/api/auth/login", "Login user", "No"],
  ["POST", "/api/auth/logout", "Logout user", "Yes"],
  ["POST", "/api/auth/refresh", "Refresh JWT", "Yes"],
  ["POST", "/api/auth/forgot-password", "Send recovery OTP", "No"],
  ["POST", "/api/auth/reset-password", "Reset password", "No"],
  ["GET", "/api/user/profile", "Fetch profile", "Yes"],
  ["PUT", "/api/user/profile", "Update profile", "Yes"],
  ["PUT", "/api/user/password", "Change password", "Yes"],
  ["DELETE", "/api/user/account", "Delete account", "Yes"],
  ["POST", "/api/user/avatar", "Update avatar URL", "Yes"],
  ["GET", "/api/devices", "List devices", "Yes"],
  ["POST", "/api/devices", "Create device", "Yes"],
  ["POST", "/api/devices/heartbeat", "Device heartbeat + sensor state", "Device key"],
  ["GET", "/api/devices/{id}", "Get device", "Yes"],
  ["PUT", "/api/devices/{id}", "Update device", "Yes"],
  ["DELETE", "/api/devices/{id}", "Delete device", "Yes"],
  ["GET", "/api/devices/{id}/status", "Device live status", "Yes"],
  ["POST", "/api/ecg/upload", "Upload ECG", "Yes"],
  ["GET", "/api/ecg/history", "ECG history", "Yes"],
  ["GET", "/api/ecg/{id}", "ECG details", "Yes"],
  ["DELETE", "/api/ecg/{id}", "Delete ECG", "Yes"],
  ["POST", "/api/ecg/{id}/analyze", "Analyze ECG", "Yes"],
  ["POST", "/api/predict", "Run ad-hoc prediction", "Yes"],
  ["GET", "/api/predictions", "List predictions", "Yes"],
  ["GET", "/api/predictions/{id}", "Prediction details", "Yes"],
  ["GET", "/api/alerts", "Alerts feed", "Yes"],
  ["POST", "/api/alerts/{id}/acknowledge", "Acknowledge alert", "Yes"],
  ["GET", "/api/alerts/settings", "Alert settings", "Yes"],
  ["PUT", "/api/alerts/settings", "Update alert settings", "Yes"],
  ["GET", "/api/dashboard/summary", "Dashboard summary", "Yes"],
  ["GET", "/api/statistics/distributions", "Distribution metrics", "Yes"],
  ["GET", "/api/statistics/correlation", "Correlation metrics", "Yes"],
  ["GET", "/api/statistics/regression", "Regression metrics", "Yes"],
  ["POST", "/api/reports/generate", "Generate report", "Yes"],
  ["GET", "/api/reports", "List reports", "Yes"],
  ["GET", "/api/reports/{id}/download", "Download report URL", "Yes"],
  ["POST", "/api/sensor/data", "Ingest ECG chunk", "Device key"],
  ["WS", "/api/ws/ecg/{device_id}", "Realtime stream", "Yes"],
];

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-4 px-6 py-8">
      <Panel title="CardioSense API Docs" subtitle="REST, WebSocket protocol, and ESP32 quick start">
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-300">
                <th className="pb-2">Method</th>
                <th className="pb-2">Path</th>
                <th className="pb-2">Description</th>
                <th className="pb-2">Auth</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((e) => (
                <tr key={e[1]} className="border-t border-slate-800 text-slate-300">
                  <td className="py-2 pr-4 mono-data">{e[0]}</td>
                  <td className="py-2 pr-4 mono-data">{e[1]}</td>
                  <td className="py-2 pr-4">{e[2]}</td>
                  <td className="py-2">{e[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="ESP32 Example Payload">
        <pre className="overflow-auto rounded-lg bg-[#051425] p-3 text-xs text-cyan-200">
{`{
  "device_id": "ESP32_001",
  "api_key": "xxxx",
  "signal": [0.12, 0.45, 0.31],
  "timestamp": 1710000000
}`}
        </pre>
      </Panel>

      <Panel title="ESP32 Required Pipeline">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
          <li>Register device and save returned api_key.</li>
          <li>Send heartbeat every 5-10s to /api/devices/heartbeat with sensor_connected=true.</li>
          <li>Send ECG chunks of exactly 60 samples to /api/sensor/data.</li>
          <li>If heartbeat is stale or sensor_connected=false, ingestion is rejected with 409.</li>
        </ol>
      </Panel>

      <Panel title="WebSocket Protocol">
        <div className="space-y-2 text-sm text-slate-300">
          <p>Connect: <span className="mono-data">wss://&lt;host&gt;/api/ws/ecg/ESP32_001</span></p>
          <p>Server broadcast message:</p>
          <pre className="overflow-auto rounded-lg bg-[#051425] p-3 text-xs text-cyan-200">
{`{
  "device_id": "ESP32_001",
  "bpm": 82,
  "signal": [0.11, 0.39, 0.51],
  "prediction": {
    "arrhythmia_type": "Normal",
    "risk_score": 0.32,
    "confidence": 0.86
  }
}`}
          </pre>
        </div>
      </Panel>

      <Panel title="ESP32 Arduino Quick Start">
        <pre className="overflow-auto rounded-lg bg-[#051425] p-3 text-xs text-cyan-200">
{`#include <WiFi.h>
#include <WebSocketsClient.h>

WebSocketsClient ws;

void setup() {
  WiFi.begin("SSID", "PASSWORD");
  while (WiFi.status() != WL_CONNECTED) delay(500);
  ws.beginSSL("your-backend.railway.app", 443, "/api/ws/ecg/ESP32_001");
}

void loop() {
  ws.loop();
  // send ECG chunk JSON every ~166ms
}
`}
        </pre>
      </Panel>
    </main>
  );
}
