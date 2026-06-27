// Hand-written DB types for Phase 1 (focused on what the foundation reads).
// Regenerate the full set from the live schema once the migrations are applied:
//   supabase gen types typescript --project-id <ref> > web/lib/supabase/types.ts

export type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
};

export type ServiceCatalog = {
  id: string;
  canonical_name: string;
  category_id: string | null;
  synonyms: string[];
  slug: string;
  is_active: boolean;
};

export type Clinic = {
  id: string;
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  website_url: string | null;
  rating: number | null;
  reviews_count: number;
  has_online_booking: boolean;
  is_active: boolean;
};

export type PriceOffer = {
  id: string;
  clinic_id: string;
  service_id: string | null;
  source_id: string | null;
  price: number; // ALWAYS KZT
  currency: string;
  original_price: number | null; // source price before conversion
  original_currency: string | null; // e.g. "USD"
  duration_days: number | null; // lab turnaround time
  price_unit: string | null;
  raw_service_name: string | null;
  source_url: string | null;
  is_active: boolean;
  last_seen_at: string;
  last_changed_at: string;
};

/** A catalog row joined with its category (shape used by autocomplete). */
export type CatalogSuggestion = ServiceCatalog & {
  category: Pick<ServiceCategory, "name" | "icon"> | null;
};
