"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";

type Suggestion = {
  id: string;
  canonical_name: string;
  slug: string;
  category: { name: string; icon: string | null } | null;
};

// Live autocomplete against the seeded services_catalog (via /api/catalog).
// This is the Phase 1 proof that Supabase is wired end to end.
export function SearchBar({ initialQuery = "" }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/catalog?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setItems(data.services ?? []);
      } catch {
        /* aborted or offline — leave previous items */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(query: string) {
    setOpen(false);
    router.push(`/poisk?q=${encodeURIComponent(query)}`);
  }

  return (
    <div ref={boxRef} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
      >
        <SearchInput
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Найдите анализ или услугу"
          autoComplete="off"
        />
      </form>

      {open && (loading || items.length > 0) && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-[2px] border border-border bg-background">
          {loading && items.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted">Поиск...</div>
          ) : (
            items.map((it) => (
              <button
                key={it.id}
                type="button"
                onMouseDown={() => go(it.canonical_name)}
                className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-left text-sm transition-colors last:border-0 hover:bg-surface"
              >
                <span>{it.canonical_name}</span>
                {it.category && (
                  <span className="shrink-0 text-xs text-muted-2">
                    {it.category.name}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
