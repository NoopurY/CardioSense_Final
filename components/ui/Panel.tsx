import { cn } from "@/lib/utils";

type PanelProps = {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function Panel({ title, subtitle, right, className, children }: PanelProps) {
  return (
    <section className={cn("cardio-panel p-4 md:p-5", className)}>
      {(title || right) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          <div>
            {title ? <h3 className="font-[var(--display)] text-lg text-cyan-300">{title}</h3> : null}
            {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}
