import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Очередь — Админка" };

export default function QueuePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Очередь нормализации</h1>
      <p className="mt-1 text-sm text-muted">
        Названия услуг, которые парсер не сопоставил уверенно, с подсказкой ИИ и
        оценкой уверенности для разбора в один клик.
      </p>

      <div className="mt-6">
        <EmptyState
          icon={Inbox}
          title="Очередь пуста"
          description="Когда парсер встретит название ниже порога уверенности, оно появится здесь с лучшей догадкой ИИ для подтверждения или назначения."
        />
      </div>
    </div>
  );
}
