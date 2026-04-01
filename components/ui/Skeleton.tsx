import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-[#0b2a47]",
        "before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-cyan-300/20 before:to-transparent before:animate-[shimmer_1.4s_infinite]",
        className,
      )}
    />
  );
}
