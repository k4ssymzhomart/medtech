import { getQueueItems, getCatalogList } from "@/lib/queries/admin";
import { QueueClient } from "./QueueClient";

export const metadata = { title: "Очередь — Админка" };
export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const [items, catalog] = await Promise.all([getQueueItems(), getCatalogList()]);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Очередь нормализации</h1>
        <span className="text-sm text-muted">{items.length} на проверке</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Названия услуг, которые парсер не сопоставил уверенно, с подсказкой и оценкой
        уверенности. Подтверждение добавляет синоним, и услуга связывается автоматически
        во всех городах при следующем запуске.
      </p>

      <div className="mt-6">
        <QueueClient items={items} catalog={catalog} />
      </div>
    </div>
  );
}
