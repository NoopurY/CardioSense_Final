"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Panel className="max-w-lg" title="500">
        <p className="mb-3 text-slate-300">Telemetry exception encountered in this module.</p>
        <Button onClick={reset}>Retry</Button>
      </Panel>
    </main>
  );
}
