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

export type QueueItem = {
  id: string;
  raw_service_name: string | null;
  confidence: number | null;
  suggested_service_id: string | null;
  created_at: string;
  source: { name: string } | null;
};

export type CatalogOption = {
  id: string;
  canonical_name: string;
  slug: string;
  category: { name: string } | null;
};

export type SourceRow = {
  id: string;
  name: string;
  url: string;
  source_type: string;
  city: string | null;
  is_active: boolean;
  last_run_at: string | null;
  consecutive_failures: number;
  last_status: string | null;
};

// Pending normalization-queue items, best guess first.
export async function getQueueItems(limit = 300): Promise<QueueItem[]> {
  try {
    const sb = createServerClient();
    const { data, error } = await sb
      .from("unmatched_queue")
      .select("id, raw_service_name, confidence, suggested_service_id, created_at, source:sources(name)")
      .eq("status", "pending")
      .order("confidence", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as QueueItem[];
  } catch {
    return [];
  }
}

// Full catalog for the resolve picker.
export async function getCatalogList(): Promise<CatalogOption[]> {
  try {
    const sb = createServerClient();
    const { data, error } = await sb
      .from("services_catalog")
      .select("id, canonical_name, slug, category:service_categories(name)")
      .eq("is_active", true)
      .order("canonical_name");
    if (error) throw error;
    return (data ?? []) as unknown as CatalogOption[];
  } catch {
    return [];
  }
}

// Sources for the admin table, with the latest run's status.
export async function getSources(): Promise<SourceRow[]> {
  try {
    const sb = createServerClient();
    const { data, error } = await sb
      .from("sources")
      .select("id, name, url, source_type, is_active, last_run_at, consecutive_failures, default_clinic_id, clinic:clinics(city)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    const rows = (data ?? []) as unknown as (Omit<SourceRow, "city" | "last_status"> & {
      clinic: { city: string } | null;
    })[];

    // Latest run per source (one query, mapped client-side).
    const ids = rows.map((r) => r.id);
    const statusBy = new Map<string, string>();
    if (ids.length) {
      const { data: runs } = await sb
        .from("parse_runs")
        .select("source_id, status, created_at")
        .in("source_id", ids)
        .order("created_at", { ascending: false })
        .limit(2000);
      for (const r of runs ?? []) {
        if (!statusBy.has(r.source_id)) statusBy.set(r.source_id, r.status);
      }
    }
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      source_type: r.source_type,
      city: r.clinic?.city ?? null,
      is_active: r.is_active,
      last_run_at: r.last_run_at,
      consecutive_failures: r.consecutive_failures,
      last_status: statusBy.get(r.id) ?? null,
    }));
  } catch {
    return [];
  }
}

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
