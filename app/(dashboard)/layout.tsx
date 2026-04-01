import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="px-4 py-4 pb-24 md:px-6 md:pb-4">
      <div className="mx-auto grid max-w-[1400px] gap-4 lg:grid-cols-[256px_1fr]">
        <Sidebar />
        <section>
          <Topbar />
          {children}
        </section>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-cyan-800/50 bg-[#031225]/95 p-2 backdrop-blur md:hidden">
        {[
          ["/dashboard", "Home"],
          ["/analysis", "Analyze"],
          ["/history", "History"],
          ["/alerts", "Alerts"],
          ["/settings", "Settings"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="rounded-lg py-2 text-center text-xs text-cyan-200">
            {label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
