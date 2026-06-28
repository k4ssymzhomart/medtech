"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListFilter, X } from "lucide-react";
import { Select } from "@/components/ui/Select";
import type { CategoryOption } from "@/lib/queries/offers";

// URL-driven filters: every change rewrites the query string and the server page
// re-renders the ranked results. No client data fetching.
export function ResultsFilters({
  cities,
  categories,
  distanceEnabled,
  currentCity = null,
}: {
  cities: string[];
  categories: CategoryOption[];
  distanceEnabled: boolean;
  currentCity?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  const has = ["city", "category", "min", "max", "sort", "open"].some((k) => sp.get(k));
  const openNow = sp.get("open") === "1";

  return (
    <aside className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ListFilter size={16} className="text-muted" />
          Фильтры
        </span>
        {has && (
          <button
            onClick={() => router.replace(`${pathname}?q=${encodeURIComponent(sp.get("q") ?? "")}`)}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
          >
            <X size={12} /> сбросить
          </button>
        )}
      </div>

      <div className="space-y-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={openNow}
            onChange={(e) => set("open", e.target.checked ? "1" : "")}
            className="h-3.5 w-3.5 accent-[var(--accent,#0070F3)]"
          />
          Работает сейчас
        </label>

        <div>
          <label className="mb-1 block text-xs text-muted">Город</label>
          <Select value={sp.get("city") || currentCity || "all"} onChange={(e) => set("city", e.target.value)}>
            <option value="all">Все города</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted">Категория</label>
          <Select value={sp.get("category") ?? ""} onChange={(e) => set("category", e.target.value)}>
            <option value="">Все категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted">Цена, ₸</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              defaultValue={sp.get("min") ?? ""}
              placeholder="от"
              onBlur={(e) => set("min", e.target.value)}
              className="h-10 w-full rounded-[2px] border border-border bg-background px-2 text-sm outline-none focus:border-accent"
            />
            <span className="text-muted-2">—</span>
            <input
              type="number"
              inputMode="numeric"
              defaultValue={sp.get("max") ?? ""}
              placeholder="до"
              onBlur={(e) => set("max", e.target.value)}
              className="h-10 w-full rounded-[2px] border border-border bg-background px-2 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted">Сортировка</label>
          <Select value={sp.get("sort") ?? "price_asc"} onChange={(e) => set("sort", e.target.value)}>
            <option value="price_asc">Сначала дешёвые</option>
            <option value="price_desc">Сначала дорогие</option>
            {distanceEnabled && <option value="distance">Сначала ближайшие</option>}
          </Select>
        </div>
      </div>
    </aside>
  );
}
