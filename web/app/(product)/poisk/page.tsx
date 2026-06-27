import { ListFilter, SearchX } from "lucide-react";
import { SearchBar } from "@/components/product/SearchBar";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Поиск услуг — MedServicePrice.kz" };

export default async function PoiskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Поиск услуг</h1>
      <p className="mt-1 text-sm text-muted">
        Введите название анализа, приёма или исследования.
      </p>

      <div className="mt-5 max-w-2xl">
        <SearchBar initialQuery={q} />
      </div>

      {q && (
        <p className="mt-4 text-sm text-muted">
          Результаты по запросу <span className="text-foreground">«{q}»</span>
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Filters rail — visual placeholder (filters land in the next step). */}
        <aside className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ListFilter size={16} className="text-muted" />
            Фильтры
          </div>
          <div className="space-y-3 opacity-60">
            <label className="block text-xs text-muted">Город</label>
            <Select disabled>
              <option>Все города</option>
            </Select>
            <label className="block text-xs text-muted">Категория</label>
            <Select disabled>
              <option>Все категории</option>
            </Select>
            <label className="block text-xs text-muted">Сортировка</label>
            <Select disabled>
              <option>Сначала дешёвые</option>
            </Select>
          </div>
          <p className="text-xs text-muted-2">Фильтры подключаются позже.</p>
        </aside>

        <section>
          <EmptyState
            icon={q ? SearchX : ListFilter}
            title="Предложения клиник появятся после подключения источников"
            description="Каталог услуг уже наполнен. Цены клиник подтянет парсер на следующем шаге, и здесь появится список, отсортированный по цене, с датой обновления."
          />
        </section>
      </div>
    </div>
  );
}
