"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

export function Button({ variant = "primary", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-xl border px-4 py-2 text-sm font-semibold transition active:scale-[0.97] hover:scale-[1.01]",
        variant === "primary" &&
          "border-cyan-400/60 bg-cyan-400/10 text-cyan-200 shadow-[0_0_24px_rgba(0,212,255,0.15)] hover:bg-cyan-400/20",
        variant === "ghost" && "border-slate-700 bg-slate-900/50 text-slate-200 hover:border-cyan-400/60",
        variant === "danger" && "border-rose-500/60 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
