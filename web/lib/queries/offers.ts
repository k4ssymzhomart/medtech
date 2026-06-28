import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { CURRENT_OFFER_MAX_AGE_DAYS } from "@/lib/utils/format";
import { isOpenNow, type Schedule } from "@/lib/utils/hours";

// One clinic's price for the searched service.
export type ServiceOffer = {
  id: string;
  price: number;
  currency: string;
  duration_days: number | null;
  last_seen_at: string;
  source_url: string | null;
  raw_service_name: string | null;
  clinic: {
    id: string;
    name: string;
    city: string | null;
    address: string | null;
    rating: number | null;
    phone: string | null;
    working_hours: Schedule | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
};

export type MatchedService = {
  id: string;
  canonical_name: string;
  slug: string;
  category: { name: string } | null;
};

export type SortKey = "price_asc" | "price_desc" | "distance";

export type OffersResult = {
  service: MatchedService | null;
  alternatives: MatchedService[];
  offers: ServiceOffer[];
  cities: string[]; // all cities offering this service (for the filter), before city filter
  minPrice: number | null;
  appliedCity: string | null; // the city actually filtered to (null = all cities)
};

const SERVICE_SELECT = "id, canonical_name, slug, category:service_categories(name)";

export type CategoryOption = { id: string; name: string };

export async function getCategories(): Promise<CategoryOption[]> {
  try {
    const sb = createServerClient();
    const { data } = await sb
      .from("service_categories")
      .select("id, name")
      .order("sort_order");
    return (data ?? []) as CategoryOption[];
  } catch {
    return [];
  }
}

// Resolve a free-text query to a catalog service: exact canonical, then partial, then
// synonym. Returns the best match + the rest as alternatives ("возможно вы искали").
async function resolveService(
  q: string,
  category?: string,
): Promise<{ primary: MatchedService | null; alternatives: MatchedService[] }> {
  const sb = createServerClient();
  const term = q.trim();
  if (!term) return { primary: null, alternatives: [] };

  const base = () => {
    let qb = sb.from("services_catalog").select(SERVICE_SELECT).eq("is_active", true);
    if (category) qb = qb.eq("category_id", category);
    return qb;
  };

  // 1) exact canonical (case-insensitive)
  const exact = await base().ilike("canonical_name", term).limit(1);
  // 2) partial canonical
  const partial = await base().ilike("canonical_name", `%${term}%`).order("canonical_name").limit(12);
  // 3) synonym (exact array element, case-insensitive handled by trying a couple forms)
  const synonym = await base().contains("synonyms", [term]).limit(6);

  const seen = new Set<string>();
  const merged: MatchedService[] = [];
  for (const row of [
    ...(exact.data ?? []),
    ...(partial.data ?? []),
    ...(synonym.data ?? []),
  ] as unknown as MatchedService[]) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      merged.push(row);
    }
  }
  return { primary: merged[0] ?? null, alternatives: merged.slice(1, 6) };
}

export type OffersOpts = {
  city?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: SortKey;
  openNow?: boolean;
};

export async function getOffersForQuery(q: string, opts: OffersOpts = {}): Promise<OffersResult> {
  const empty: OffersResult = {
    service: null, alternatives: [], offers: [], cities: [], minPrice: null, appliedCity: null,
  };
  try {
    const { primary, alternatives } = await resolveService(q, opts.category);
    if (!primary) return empty;

    const sb = createServerClient();
    const since = new Date(Date.now() - CURRENT_OFFER_MAX_AGE_DAYS * 86_400_000).toISOString();

    // Select clinic geo columns optimistically; retry without them if not migrated yet.
    const withGeo =
      "id, price, currency, duration_days, last_seen_at, source_url, raw_service_name, " +
      "clinic:clinics(id, name, city, address, rating, phone, working_hours, lat, lng)";
    const noGeo =
      "id, price, currency, duration_days, last_seen_at, source_url, raw_service_name, " +
      "clinic:clinics(id, name, city, address, rating, phone, working_hours)";

    const run = (sel: string) =>
      sb
        .from("price_offers")
        .select(sel)
        .eq("service_id", primary.id)
        .eq("is_active", true)
        .gte("last_seen_at", since)
        .limit(500);

    let res = await run(withGeo);
    if (res.error) res = await run(noGeo);
    let offers = ((res.data ?? []) as unknown as ServiceOffer[]).filter((o) => o.clinic);

    // City list across all offers (for the filter dropdown), before applying city filter.
    const cities = [...new Set(offers.map((o) => o.clinic?.city).filter(Boolean) as string[])].sort(
      (a, b) => a.localeCompare(b, "ru"),
    );

    // Default to the richest city (most distinct clinics) so a no-city search doesn't return
    // the same brand repeated across 20 cities. "all" shows every city; an explicit city wins.
    let appliedCity: string | null;
    if (opts.city === "all") {
      appliedCity = null;
    } else if (opts.city) {
      appliedCity = opts.city;
    } else {
      const byCity = new Map<string, Set<string>>();
      for (const o of offers) {
        const c = o.clinic?.city;
        if (c) (byCity.get(c) ?? byCity.set(c, new Set()).get(c)!).add(o.clinic!.id);
      }
      appliedCity = [...byCity.entries()].sort((a, b) => b[1].size - a[1].size)[0]?.[0] ?? null;
    }
    if (appliedCity) offers = offers.filter((o) => o.clinic?.city === appliedCity);
    if (opts.minPrice != null) offers = offers.filter((o) => o.price >= opts.minPrice!);
    if (opts.maxPrice != null) offers = offers.filter((o) => o.price <= opts.maxPrice!);
    if (opts.openNow) offers = offers.filter((o) => isOpenNow(o.clinic?.working_hours));

    const minPrice = offers.length ? Math.min(...offers.map((o) => o.price)) : null;

    // Default + price sorts here; distance sort is applied client-side (needs geolocation).
    if (opts.sort === "price_desc") offers.sort((a, b) => b.price - a.price);
    else if (opts.sort !== "distance") offers.sort((a, b) => a.price - b.price);

    return { service: primary, alternatives, offers, cities, minPrice, appliedCity };
  } catch {
    return empty;
  }
}
