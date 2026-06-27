import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { CatalogSuggestion } from "@/lib/supabase/types";

// Autocomplete source for /poisk. Reads the seeded services_catalog from Supabase
// (the one live data path proven in Phase 1). Synonym/trigram matching is a
// Phase 2 enhancement; here we substring-match the canonical name.
export async function searchCatalog(
  query: string,
  limit = 8,
): Promise<CatalogSuggestion[]> {
  const sb = createServerClient();
  let q = sb
    .from("services_catalog")
    .select(
      "id, canonical_name, slug, category_id, synonyms, is_active, category:service_categories(name, icon)",
    )
    .eq("is_active", true)
    .order("canonical_name")
    .limit(limit);

  const term = query.trim();
  if (term) q = q.ilike("canonical_name", `%${term}%`);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as CatalogSuggestion[];
}
