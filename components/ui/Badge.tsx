import { cn } from "@/lib/utils";

type BadgeProps = {
  tone?: "info" | "success" | "warning" | "danger";
  className?: string;
  children: React.ReactNode;
};

export function Badge({ tone = "info", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone === "info" && "border-cyan-400/50 bg-cyan-500/10 text-cyan-300",
        tone === "success" && "border-emerald-400/50 bg-emerald-500/10 text-emerald-300",
        tone === "warning" && "border-amber-300/50 bg-amber-500/10 text-amber-300",
        tone === "danger" && "border-rose-500/50 bg-rose-500/10 text-rose-300",
        className,
      )}
    >
      {children}
    </span>
  );
}
