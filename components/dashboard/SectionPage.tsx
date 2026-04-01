import { Panel } from "@/components/ui/Panel";

type SectionPageProps = {
  title: string;
  subtitle: string;
  blocks: { title: string; text: string }[];
};

export function SectionPage({ title, subtitle, blocks }: SectionPageProps) {
  return (
    <div className="space-y-4">
      <Panel>
        <h1 className="font-[var(--display)] text-3xl text-cyan-300">{title}</h1>
        <p className="text-slate-300">{subtitle}</p>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {blocks.map((b) => (
          <Panel key={b.title} title={b.title}>
            <p className="text-sm text-slate-300">{b.text}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
