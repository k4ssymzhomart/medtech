import { ShieldCheck, TrendingDown, RefreshCw } from "lucide-react";
import type { CoverageStats } from "@/lib/queries/stats";

const REASONS = [
  {
    icon: ShieldCheck,
    title: "Прозрачность",
    text: "Реальные цены из открытых источников, а не догадки.",
  },
  {
    icon: TrendingDown,
    title: "Экономия",
    text: "Видно, где та же услуга стоит дешевле.",
  },
  {
    icon: RefreshCw,
    title: "Актуальность",
    text: "Цены обновляются автоматически, видна дата обновления.",
  },
];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-background p-6 text-center">
      <div className="numeric text-3xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  );
}

// Coverage numbers are pulled from live counts — never invented (Design Law).
export function WhyUs({ stats }: { stats: CoverageStats }) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-bold tracking-tight">Почему мы</h2>

        <div className="mt-8 grid gap-px overflow-hidden rounded-[2px] border border-border bg-border sm:grid-cols-3">
          {REASONS.map((r) => (
            <div key={r.title} className="bg-background p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-[2px] border border-border text-accent">
                <r.icon size={18} />
              </span>
              <h3 className="mt-4 text-base font-semibold">{r.title}</h3>
              <p className="mt-1 text-sm text-muted">{r.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-px grid gap-px overflow-hidden rounded-[2px] border border-border bg-border sm:grid-cols-3">
          <Stat value={String(stats.services)} label="услуг в каталоге" />
          <Stat
            value={stats.clinics > 0 ? String(stats.clinics) : "скоро"}
            label="клиник"
          />
          <Stat
            value={stats.cities > 0 ? String(stats.cities) : "скоро"}
            label="городов"
          />
        </div>
      </div>
    </section>
  );
}
