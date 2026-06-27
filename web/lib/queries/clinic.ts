import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { CURRENT_OFFER_MAX_AGE_DAYS } from "@/lib/utils/format";

export type ClinicOffer = {
  id: string;
  price: number;
  last_seen_at: string;
  duration_days: number | null;
  source_url: string | null;
  service: { id: string; canonical_name: string; slug: string; category: { name: string } | null } | null;
};

export type ClinicDetail = {
  clinic: {
    id: string;
    name: string;
    city: string | null;
    address: string | null;
    phone: string | null;
    website_url: string | null;
    rating: number | null;
    lat: number | null;
    lng: number | null;
  };
  offers: ClinicOffer[];
};

const OFFER_SELECT =
  "id, price, last_seen_at, duration_days, source_url, " +
  "service:services_catalog(id, canonical_name, slug, category:service_categories(name))";

export async function getClinic(id: string): Promise<ClinicDetail | null> {
  try {
    const sb = createServerClient();
    const { data: clinic } = await sb
      .from("clinics")
      .select("id, name, city, address, phone, website_url, rating, lat, lng")
      .eq("id", id)
      .single();
    if (!clinic) return null;

    const since = new Date(Date.now() - CURRENT_OFFER_MAX_AGE_DAYS * 86_400_000).toISOString();
    const { data: offers } = await sb
      .from("price_offers")
      .select(OFFER_SELECT)
      .eq("clinic_id", id)
      .eq("is_active", true)
      .gte("last_seen_at", since)
      .order("price")
      .limit(500);

    const list = ((offers ?? []) as unknown as ClinicOffer[]).filter((o) => o.service);
    list.sort((a, b) =>
      (a.service!.canonical_name).localeCompare(b.service!.canonical_name, "ru"),
    );
    return { clinic: clinic as ClinicDetail["clinic"], offers: list };
  } catch {
    return null;
  }
}

export type CompareClinic = { id: string; name: string; city: string | null; address: string | null };
export type CompareRow = {
  service: { id: string; canonical_name: string; slug: string };
  prices: Record<string, number>; // clinicId -> price
  min: number;
};
export type CompareData = { clinics: CompareClinic[]; rows: CompareRow[] };

// Service x clinic price matrix for the selected clinics (the compare table).
export async function getCompareData(clinicIds: string[]): Promise<CompareData> {
  const empty: CompareData = { clinics: [], rows: [] };
  const ids = [...new Set(clinicIds.filter(Boolean))].slice(0, 4);
  if (ids.length < 1) return empty;
  try {
    const sb = createServerClient();
    const { data: clinicRows } = await sb
      .from("clinics")
      .select("id, name, city, address")
      .in("id", ids);
    const clinics = (clinicRows ?? []) as CompareClinic[];
    if (!clinics.length) return empty;

    const since = new Date(Date.now() - CURRENT_OFFER_MAX_AGE_DAYS * 86_400_000).toISOString();
    const { data: offers } = await sb
      .from("price_offers")
      .select("clinic_id, price, service:services_catalog(id, canonical_name, slug)")
      .in("clinic_id", ids)
      .eq("is_active", true)
      .gte("last_seen_at", since)
      .limit(2000);

    const byService = new Map<string, CompareRow>();
    for (const o of (offers ?? []) as unknown as {
      clinic_id: string;
      price: number;
      service: { id: string; canonical_name: string; slug: string } | null;
    }[]) {
      if (!o.service) continue;
      let row = byService.get(o.service.id);
      if (!row) {
        row = { service: o.service, prices: {}, min: Infinity };
        byService.set(o.service.id, row);
      }
      // keep the cheapest price per (service, clinic)
      if (row.prices[o.clinic_id] == null || o.price < row.prices[o.clinic_id]) {
        row.prices[o.clinic_id] = o.price;
      }
    }
    const rows = [...byService.values()];
    for (const r of rows) r.min = Math.min(...Object.values(r.prices));
    // services common to the most clinics first, then by name
    rows.sort((a, b) => {
      const d = Object.keys(b.prices).length - Object.keys(a.prices).length;
      return d !== 0 ? d : a.service.canonical_name.localeCompare(b.service.canonical_name, "ru");
    });
    return { clinics, rows };
  } catch {
    return empty;
  }
}
