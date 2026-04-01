import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { Panel } from "@/components/ui/Panel";
import { heroStats, features } from "@/lib/app-data";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl">
        <section className="cardio-panel ecg-grid overflow-hidden p-8 md:p-12">
          <p className="mb-2 text-sm uppercase tracking-[0.2em] text-cyan-300/80">AI Cardiac Platform</p>
          <h1 className="mb-4 max-w-3xl font-[var(--display)] text-4xl md:text-6xl">
            <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-rose-300 bg-clip-text text-transparent">
              Where AI Meets Every Heartbeat
            </span>
          </h1>
          <p className="max-w-2xl text-slate-300">
            Real-time ECG ingestion, arrhythmia intelligence, and advanced statistics in a mission-control interface.
          </p>
          <div className="my-6 ecg-line" />
          <div className="flex flex-wrap gap-3">
            <Link className="rounded-xl border border-cyan-400/60 bg-cyan-400/10 px-4 py-2 text-cyan-100" href="/auth/login">
              Launch Dashboard
            </Link>
            <Link className="rounded-xl border border-slate-700 px-4 py-2 text-slate-200" href="/docs">
              View API Docs
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          {heroStats.map((item) => (
            <Panel key={item.label}>
              <p className="text-xs uppercase tracking-wider text-slate-400">{item.label}</p>
              <p className="glow-text text-3xl">{item.value}</p>
            </Panel>
          ))}
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {features.map((feature, idx) => (
            <article
              key={feature}
              className="cardio-panel group p-5 transition hover:-translate-y-1"
              style={{
                background:
                  idx % 3 === 0
                    ? "linear-gradient(160deg, rgba(0,212,255,0.16), rgba(7,30,53,0.92))"
                    : idx % 3 === 1
                      ? "linear-gradient(160deg, rgba(255,34,68,0.12), rgba(7,30,53,0.92))"
                      : "linear-gradient(160deg, rgba(0,255,136,0.13), rgba(7,30,53,0.92))",
              }}
            >
              <p className="mb-2 inline-flex rounded-full border border-cyan-400/50 px-2 py-1 text-xs text-cyan-200">Module {idx + 1}</p>
              <h3 className="font-[var(--display)] text-2xl text-cyan-100">{feature}</h3>
              <p className="mt-2 text-sm text-slate-300">Faster insight, cleaner telemetry, and premium workflow control.</p>
              <div className="mt-3 h-2 w-full rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-sky-300 to-cyan-500 transition-all group-hover:w-full" style={{ width: `${55 + idx * 6}%` }} />
              </div>
            </article>
          ))}
        </section>

        <Footer />
      </div>
    </main>
  );
}
