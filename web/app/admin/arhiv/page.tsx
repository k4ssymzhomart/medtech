import { Archive } from "lucide-react";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Архив — Админка" };

export default function ArchivePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Архив</h1>
      <p className="mt-1 text-sm text-muted">
        Предложения, клиники и источники, выбывшие из ленты, с причиной и датой.
        Восстановление в один клик.
      </p>

      <div className="mt-6">
        <Tabs
          tabs={[
            {
              label: "Предложения",
              content: (
                <EmptyState
                  icon={Archive}
                  title="Архив предложений пуст"
                  description="Сюда попадут предложения, которые источник перестал публиковать, с причиной not_in_latest_parse."
                />
              ),
            },
            {
              label: "Клиники",
              content: (
                <EmptyState
                  icon={Archive}
                  title="Архив клиник пуст"
                  description="Архивированные клиники появятся здесь с возможностью восстановления."
                />
              ),
            },
            {
              label: "Источники",
              content: (
                <EmptyState
                  icon={Archive}
                  title="Архив источников пуст"
                  description="Источники, выключенные после серии ошибок, попадут сюда."
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
