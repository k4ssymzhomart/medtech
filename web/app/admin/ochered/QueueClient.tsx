"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, X, Inbox } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { resolveQueueItem, ignoreQueueItem } from "@/lib/actions/admin";
import type { QueueItem, CatalogOption } from "@/lib/queries/admin";

export function QueueClient({
  items,
  catalog,
}: {
  items: QueueItem[];
  catalog: CatalogOption[];
}) {
  const [rows, setRows] = useState(items);
  // Map canonical name <-> id. One shared <datalist> renders the catalog once (instead
  // of a full <select> per row), so the page stays light with hundreds of queue rows.
  const { byId, byName } = useMemo(() => {
    const byId = new Map(catalog.map((c) => [c.id, c.canonical_name]));
    const byName = new Map(catalog.map((c) => [c.canonical_name.toLowerCase(), c.id]));
    return { byId, byName };
  }, [catalog]);

  const [picks, setPicks] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.map((i) => [i.id, i.suggested_service_id ? byId.get(i.suggested_service_id) ?? "" : ""]),
    ),
  );
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function resolve(id: string) {
    const serviceId = byName.get((picks[id] ?? "").trim().toLowerCase());
    if (!serviceId) return;
    setBusyId(id);
    start(async () => {
      try {
        await resolveQueueItem(id, serviceId);
        setRows((r) => r.filter((x) => x.id !== id));
      } finally {
        setBusyId(null);
      }
    });
  }

  function ignore(id: string) {
    setBusyId(id);
    start(async () => {
      try {
        await ignoreQueueItem(id);
        setRows((r) => r.filter((x) => x.id !== id));
      } finally {
        setBusyId(null);
      }
    });
  }

  if (!rows.length) {
    return (
      <EmptyState
        icon={Inbox}
        title="Очередь пуста"
        description="Когда парсер встретит название ниже порога уверенности, оно появится здесь с лучшей догадкой для подтверждения или назначения."
      />
    );
  }

  return (
    <>
    <datalist id="catalog-services">
      {catalog.map((c) => (
        <option key={c.id} value={c.canonical_name}>
          {c.category?.name ?? ""}
        </option>
      ))}
    </datalist>
    <Table>
      <THead>
        <TR>
          <TH className="w-[34%]">Сырое название</TH>
          <TH>Источник</TH>
          <TH className="w-20 text-right">Оценка</TH>
          <TH className="w-[28%]">Услуга каталога</TH>
          <TH className="w-40 text-right">Действие</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((it) => {
          const busy = pending && busyId === it.id;
          return (
            <TR key={it.id}>
              <TD className="font-mono text-[13px]">{it.raw_service_name}</TD>
              <TD className="text-muted">{it.source?.name ?? "—"}</TD>
              <TD className="text-right tabular-nums text-muted">
                {it.confidence != null ? it.confidence.toFixed(2) : "—"}
              </TD>
              <TD>
                <input
                  list="catalog-services"
                  value={picks[it.id] ?? ""}
                  disabled={busy}
                  placeholder="услуга каталога"
                  onChange={(e) => setPicks((p) => ({ ...p, [it.id]: e.target.value }))}
                  className="h-9 w-full rounded-[2px] border border-border bg-background px-3 text-sm outline-none focus:border-accent"
                />
              </TD>
              <TD>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={busy || !byName.get((picks[it.id] ?? "").trim().toLowerCase())}
                    onClick={() => resolve(it.id)}
                  >
                    <Check size={14} /> Связать
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => ignore(it.id)}
                    aria-label="Игнорировать"
                  >
                    <X size={14} />
                  </Button>
                </div>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
    </>
  );
}
