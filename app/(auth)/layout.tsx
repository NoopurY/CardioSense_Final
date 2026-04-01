import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen grid-cols-1 overflow-hidden lg:grid-cols-2">
      {/* Left panel — marketing / branding */}
      <section className="ecg-grid relative hidden lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div>
          <Link href="/" className="inline-block">
            <h1 className="font-[var(--display)] text-5xl text-cyan-300 hover:text-cyan-200 transition-colors">
              CardioSense
            </h1>
          </Link>
          <p className="mt-3 max-w-sm text-slate-300 leading-relaxed">
            Real-time ECG ingestion, AI arrhythmia intelligence, and advanced cardiac statistics — in a mission-control interface.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="space-y-4 max-w-sm">
          {[
            { icon: "🫀", title: "Live ECG Streaming", desc: "Continuous monitoring from your ESP32 device" },
            { icon: "🤖", title: "AI Arrhythmia Detection", desc: "ML-powered cardiac anomaly classification" },
            { icon: "🔒", title: "Secure & Private", desc: "End-to-end encrypted health data storage" },
          ].map((f) => (
            <div key={f.title} className="cardio-panel flex items-start gap-3 p-4">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <p className="text-sm font-semibold text-cyan-200">{f.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="ecg-line" />
      </section>

      {/* Right panel — auth form */}
      <section className="flex items-center justify-center p-6 md:p-10">
        {children}
      </section>
    </main>
  );
}
