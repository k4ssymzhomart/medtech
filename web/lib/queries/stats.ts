import "server-only";
import { createServerClient } from "@/lib/supabase/server";

export type CoverageStats = {
  services: number;
  clinics: number;
  cities: number;
  offers: number;
};

const ZERO: CoverageStats = { services: 0, clinics: 0, cities: 0, offers: 0 };

// Real counts for the landing "Почему мы" stat. Never invented (Design Law).
// Resilient: returns zeros if the schema is not applied yet, so the landing
// still renders before migrations run.
export async function getCoverageStats(): Promise<CoverageStats> {
  try {
    const sb = createServerClient();
    const [services, clinics, offers, cities] = await Promise.all([
      sb
        .from("services_catalog")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      sb
        .from("clinics")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      sb
        .from("price_offers")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      sb.from("clinics").select("city").eq("is_active", true),
    ]);

    const cityCount = new Set(
      (cities.data ?? []).map((r: { city: string }) => r.city),
    ).size;

    return {
      services: services.count ?? 0,
      clinics: clinics.count ?? 0,
      offers: offers.count ?? 0,
      cities: cityCount,
    };
  } catch {
    return ZERO;
  }
}
