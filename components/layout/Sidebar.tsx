"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardLinks } from "@/lib/app-data";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="cardio-panel sticky top-4 hidden h-[calc(100vh-2rem)] w-64 p-4 lg:block">
      <div className="mb-5">
        <p className="font-[var(--display)] text-2xl text-cyan-300">CardioSense</p>
        <p className="text-xs text-slate-400">Mission Control</p>
      </div>
      <nav className="grid gap-2">
        {dashboardLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm transition",
              pathname === item.href
                ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200"
                : "border-slate-700/60 text-slate-300 hover:border-cyan-400/50",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
