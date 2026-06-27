import "server-only";
import { createServerClient } from "@/lib/supabase/server";

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  label: string | null;
  description: string | null;
};

// Reads feature_flags. Degrades to "all off" if the table isn't migrated yet, so the
// app never breaks waiting on the DDL paste.
export async function getFlags(): Promise<FeatureFlag[]> {
  try {
    const sb = createServerClient();
    const { data, error } = await sb
      .from("feature_flags")
      .select("key, enabled, label, description")
      .order("key");
    if (error) throw error;
    return (data ?? []) as FeatureFlag[];
  } catch {
    return [];
  }
}

export async function getFlag(key: string): Promise<boolean> {
  const flags = await getFlags();
  return flags.find((f) => f.key === key)?.enabled ?? false;
}
