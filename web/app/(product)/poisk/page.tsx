import { SearchX, ListFilter, Search } from "lucide-react";
import Link from "next/link";
import { SearchBar } from "@/components/product/SearchBar";
import { ResultsFilters } from "@/components/product/ResultsFilters";
import { ResultsView } from "@/components/product/ResultsView";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { getOffersForQuery, getCategories, type SortKey } from "@/lib/queries/offers";
import { getFlag } from "@/lib/queries/flags";
import { formatPrice } from "@/lib/utils/format";

export const metadata = { title: "Поиск услуг — MedServicePrice.kz" };
export const dynamic = "force-dynamic";

type SP = {
  q?: string;
  city?: string;
  category?: string;
  min?: string;
  max?: string;
  sort?: string;
  open?: string;
};

export default async function PoiskPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const [{ service, alternatives, offers, cities, minPrice, appliedCity }, categories, distanceEnabled] =
    await Promise.all([
      q
        ? getOffersForQuery(q, {
            city: sp.city,
            category: sp.category,
            minPrice: sp.min ? Number(sp.min) : undefined,
            maxPrice: sp.max ? Number(sp.max) : undefined,
            sort: (sp.sort as SortKey) ?? "price_asc",
            openNow: sp.open === "1",
          })
        : Promise.resolve({ service: null, alternatives: [], offers: [], cities: [], minPrice: null, appliedCity: null }),
      getCategories(),
      getFlag("distance_sort"),
    ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Поиск услуг</h1>
      <p className="mt-1 text-sm text-muted">
        Введите название анализа, приёма или исследования и сравните цены клиник.
      </p>

      <div className="mt-5 max-w-2xl">
        <SearchBar initialQuery={q} />
      </div>

      {!q ? (
        <div className="mt-8">
          <EmptyState
            icon={Search}
            title="Начните с поиска услуги"
            description="Например: ОАК, глюкоза, ТТГ, витамин D, биохимия. Покажем все клиники с ценами, от самой дешёвой."
          />
        </div>
      ) : !service ? (
        <div className="mt-8">
          <EmptyState
            icon={SearchX}
            title={`Ничего не найдено по запросу «${q}»`}
            description="Попробуйте другое название или сокращение."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-baseline gap-3">
            <h2 className="text-lg font-semibold">{service.canonical_name}</h2>
            {service.category && <Badge variant="outline">{service.category.name}</Badge>}
            <span className="text-sm text-muted">
              {offers.length
                ? `${offers.length} ${offers.length === 1 ? "клиника" : "клиник"}${
                    appliedCity ? ` в городе ${appliedCity}` : ""
                  }${minPrice != null ? `, от ${formatPrice(minPrice)}` : ""}`
                : "нет актуальных предложений"}
            </span>
          </div>

          {alternatives.length > 0 && (
            <p className="mt-2 text-sm text-muted">
              Возможно вы искали:{" "}
              {alternatives.map((a, i) => (
                <span key={a.id}>
                  {i > 0 && ", "}
                  <Link href={`/poisk?q=${encodeURIComponent(a.canonical_name)}`} className="text-accent hover:underline">
                    {a.canonical_name}
                  </Link>
                </span>
              ))}
            </p>
          )}

          <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
            <ResultsFilters cities={cities} categories={categories} distanceEnabled={distanceEnabled} currentCity={appliedCity} />
            <section>
              {offers.length === 0 ? (
                <EmptyState
                  icon={ListFilter}
                  title="Нет предложений под выбранные фильтры"
                  description="Сбросьте фильтры или расширьте диапазон цены."
                />
              ) : (
                <ResultsView
                  offers={offers}
                  minPrice={minPrice}
                  serviceSlug={service.slug}
                  distanceEnabled={distanceEnabled}
                  sort={sp.sort ?? "price_asc"}
                />
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
