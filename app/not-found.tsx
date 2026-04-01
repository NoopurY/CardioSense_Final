import Link from "next/link";
import { Panel } from "@/components/ui/Panel";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Panel className="max-w-md" title="404">
        <p className="mb-3 text-slate-300">Signal lost. This route does not exist.</p>
        <Link href="/" className="text-cyan-300 underline">
          Return to Control Center
        </Link>
      </Panel>
    </main>
  );
}
