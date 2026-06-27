import { Plus, Database } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Источники — Админка" };

export default function SourcesPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Источники</h1>
          <p className="mt-1 text-sm text-muted">
            Добавьте URL клиники и частоту, нажмите запуск и наблюдайте, как
            появляются цены.
          </p>
        </div>
        <button
          type="button"
          disabled
          className="inline-flex h-9 items-center gap-2 rounded-[2px] border border-border bg-background px-4 text-sm font-medium text-muted-2"
        >
          <Plus size={16} />
          Добавить источник
        </button>
      </div>

      <div className="mt-6">
        <Table>
          <THead>
            <TR>
              <TH>Название</TH>
              <TH>URL</TH>
              <TH>Тип</TH>
              <TH>Частота</TH>
              <TH>Последний запуск</TH>
              <TH>Статус</TH>
            </TR>
          </THead>
          <TBody>
            <TR>
              <TD colSpan={6} className="p-0">
                <EmptyState
                  icon={Database}
                  title="Источники ещё не добавлены"
                  description="Управление источниками, запуск парсинга и просмотр логов подключаются на шаге админки."
                />
              </TD>
            </TR>
          </TBody>
        </Table>
      </div>
    </div>
  );
}
