import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export function Input({ label, error, className, id, ...props }: InputProps) {
  const fieldId = id ?? props.name;

  return (
    <label className="grid gap-2 text-sm" htmlFor={fieldId}>
      {label ? <span className="text-slate-300">{label}</span> : null}
      <input
        id={fieldId}
        className={cn(
          "w-full rounded-xl border border-[#0d4f8c]/60 bg-[#041a2e] px-3 py-2 text-slate-100 outline-none transition",
          "focus:border-cyan-300 focus:shadow-[0_0_0_3px_rgba(0,212,255,0.2)]",
          error && "border-rose-500 focus:shadow-[0_0_0_3px_rgba(255,34,68,0.2)]",
          className,
        )}
        {...props}
      />
      {error ? <span className="text-xs text-rose-400">{error}</span> : null}
    </label>
  );
}
