import { GitCompareArrows } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Сравнение клиник — MedServicePrice.kz" };

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Сравнение клиник</h1>
      <p className="mt-1 text-sm text-muted">
        Выберите от 2 до 4 клиник в результатах поиска, чтобы сравнить цены, адреса,
        часы работы и запись.
      </p>

      <div className="mt-8">
        <EmptyState
          icon={GitCompareArrows}
          title="Пока нечего сравнивать"
          description="Таблица сравнения по выбранным клиникам появится здесь после подключения источников и выбора клиник в поиске."
        />
      </div>
    </div>
  );
}
