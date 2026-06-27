"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Play, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Database } from "lucide-react";
import { addSource, runNow } from "@/lib/actions/admin";
import type { SourceRow } from "@/lib/queries/admin";

const STATUS_LABEL: Record<string, string> = {
  queued: "в очереди",
  running: "выполняется",
  success: "успешно",
  partial: "частично",
  failed: "ошибка",
};

function RunNowButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => start(() => runNow(id))}
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
      Запустить
    </Button>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ kind: "warn" | "err"; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submit(force: boolean, fd?: FormData) {
    const data = fd ?? new FormData(formRef.current!);
    start(async () => {
      const res = await addSource(data, force);
      if (res.ok) {
        setNotice(null);
        onDone();
      } else {
        setNotice({ kind: res.conflict ? "warn" : "err", text: res.message });
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={(fd) => submit(false, fd)}
      className="mb-6 grid grid-cols-1 gap-3 rounded-[2px] border border-border bg-surface p-4 sm:grid-cols-2"
    >
      <label className="text-sm">
        <span className="mb-1 block text-muted">Название</span>
        <input name="name" required placeholder="Invitro Алматы"
          className="h-10 w-full rounded-[2px] border border-border bg-background px-3 text-sm outline-none focus:border-accent" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-muted">Город</span>
        <input name="city" placeholder="Алматы"
          className="h-10 w-full rounded-[2px] border border-border bg-background px-3 text-sm outline-none focus:border-accent" />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block text-muted">URL прайс листа</span>
        <input name="url" required type="url" placeholder="https://..."
          className="h-10 w-full rounded-[2px] border border-border bg-background px-3 text-sm outline-none focus:border-accent" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-muted">Тип</span>
        <Select name="source_type" defaultValue="html">
          <option value="html">HTML</option>
          <option value="pdf">PDF</option>
          <option value="xlsx">XLSX</option>
          <option value="docx">DOCX</option>
        </Select>
      </label>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Сохранить источник
        </Button>
      </div>

      {notice && (
        <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-[2px] border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-warning">

          <span className="inline-flex items-center gap-2">
            <AlertTriangle size={15} />
            {notice.text}
          </span>
          {notice.kind === "warn" && (
            <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => submit(true)}>
              Добавить всё равно
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

export function SourcesClient({ sources }: { sources: SourceRow[] }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Источники</h1>
          <p className="mt-1 text-sm text-muted">
            Добавьте URL клиники, нажмите запуск и наблюдайте, как появляются цены.
          </p>
        </div>
        <Button variant={showForm ? "secondary" : "primary"} onClick={() => setShowForm((s) => !s)}>
          <Plus size={16} />
          {showForm ? "Скрыть форму" : "Добавить источник"}
        </Button>
      </div>

      <div className="mt-6">
        {showForm && <AddForm onDone={() => setShowForm(false)} />}

        <Table>
          <THead>
            <TR>
              <TH>Название</TH>
              <TH>Город</TH>
              <TH>URL</TH>
              <TH>Тип</TH>
              <TH>Статус</TH>
              <TH className="text-right">Действие</TH>
            </TR>
          </THead>
          <TBody>
            {sources.length === 0 ? (
              <TR>
                <TD colSpan={6} className="p-0">
                  <EmptyState
                    icon={Database}
                    title="Источники ещё не добавлены"
                    description="Добавьте первый источник через форму выше."
                  />
                </TD>
              </TR>
            ) : (
              sources.map((s) => (
                <TR key={s.id}>
                  <TD className="font-medium">{s.name}</TD>
                  <TD className="text-muted">{s.city ?? "—"}</TD>
                  <TD className="max-w-[200px] truncate text-muted">
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-accent">
                      {s.url.replace(/^https?:\/\//, "")}
                      <ExternalLink size={12} />
                    </a>
                  </TD>
                  <TD className="uppercase text-muted">{s.source_type}</TD>
                  <TD>
                    {s.last_status ? (
                      <Badge variant={s.last_status === "success" ? "fresh" : s.last_status === "failed" ? "stale" : "default"}>
                        {STATUS_LABEL[s.last_status] ?? s.last_status}
                      </Badge>
                    ) : (
                      <span className="text-muted-2">нет запусков</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <RunNowButton id={s.id} />
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
