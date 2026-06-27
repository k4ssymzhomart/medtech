import "server-only";
import { createServerClient } from "@/lib/supabase/server";

export type AdminStats = {
  catalog: number;
  categories: number;
  sources: number;
  offers: number;
  queue: number;
  archived: number;
};

const ZERO: AdminStats = {
  catalog: 0,
  categories: 0,
  sources: 0,
  offers: 0,
  queue: 0,
  archived: 0,
};

// Live KPI counts for the admin dashboard. Resilient to a not-yet-applied schema.
export async function getAdminStats(): Promise<AdminStats> {
  try {
    const sb = createServerClient();
    const head = (t: string) =>
      sb.from(t).select("id", { count: "exact", head: true });

    const [catalog, categories, sources, offers, queue, archived] =
      await Promise.all([
        head("services_catalog").eq("is_active", true),
        head("service_categories"),
        head("sources"),
        head("price_offers").eq("is_active", true),
        head("unmatched_queue").eq("status", "pending"),
        head("price_offers").eq("is_active", false),
      ]);

    return {
      catalog: catalog.count ?? 0,
      categories: categories.count ?? 0,
      sources: sources.count ?? 0,
      offers: offers.count ?? 0,
      queue: queue.count ?? 0,
      archived: archived.count ?? 0,
    };
  } catch {
    return ZERO;
  }
}
