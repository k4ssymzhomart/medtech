import Link from "next/link";
import { Search } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import type { CoverageStats } from "@/lib/queries/stats";

const POPULAR = [
  "ОАК",
  "УЗИ брюшной полости",
  "Приём терапевта",
  "ТТГ",
  "МРТ",
];

const ru = (n: number) => n.toLocaleString("ru-RU");

export function Hero({ stats }: { stats: CoverageStats }) {
  const trust = [
    [ru(stats.offers), "цен"],
    [ru(stats.clinics), "клиник"],
    [ru(stats.cities), "городов"],
    [ru(stats.services), "услуг"],
  ];
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-3xl px-6 py-24 text-center sm:py-32">
        <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-[3.25rem]">
          Цены на медицинские услуги по всему Казахстану в одном месте
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-balance text-base text-muted sm:text-lg">
          Сравните анализы, приёмы врачей, УЗИ и диагностику в клиниках. Прозрачно
          и бесплатно.
        </p>

        {/* GET form deep-links into /poisk with the query prefilled. */}
        <form
          action="/poisk"
          method="get"
          className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row"
        >
          <div className="flex-1">
            <SearchInput
              name="q"
              placeholder="Найдите анализ или услугу"
              aria-label="Поиск услуги"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[2px] border border-accent bg-accent px-6 font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            <Search size={18} />
            Начать поиск
          </button>
        </form>

        <div className="mx-auto mt-6 flex max-w-xl flex-wrap items-center justify-center gap-2">
          <span className="text-sm text-muted-2">Популярное:</span>
          {POPULAR.map((q) => (
            <Link
              key={q}
              href={`/poisk?q=${encodeURIComponent(q)}`}
              className="rounded-[2px] border border-border px-2.5 py-1 text-sm text-muted transition-colors hover:border-foreground hover:text-foreground"
            >
              {q}
            </Link>
          ))}
        </div>

        {stats.offers > 0 && (
          <div className="mx-auto mt-12 flex max-w-lg flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {trust.map(([n, label]) => (
              <div key={label} className="text-center">
                <div className="numeric text-2xl font-bold tracking-tight">{n}</div>
                <div className="text-xs uppercase tracking-wide text-muted-2">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
