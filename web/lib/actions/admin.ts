"use server";

// Admin mutations (service role, server only). Three flows the TZ asks for:
//   • resolve / ignore a normalization-queue item (1 click -> offer + learned synonym)
//   • add a source (creates the clinic + source rows the worker will parse)
//   • "Run now" (inserts a queued parse_run; the worker polls and processes it)
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

const FX_USD_KZT = Number(process.env.FX_USD_KZT ?? 470);

function durationDays(d: string | null): number | null {
  if (!d) return null;
  const m = d.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/**
 * Resolve a queued raw name to a catalog service: append it as a synonym (so every
 * future parse — in every city — auto-links it), create the price offer from the raw
 * extraction, and mark the queue item resolved. This is the manual-markup loop.
 */
export async function resolveQueueItem(queueId: string, serviceId: string) {
  if (!serviceId) throw new Error("Не выбрана услуга");
  const sb = createServerClient();

  const { data: q } = await sb
    .from("unmatched_queue")
    .select("id, raw_service_name, raw_extraction_id, source_id")
    .eq("id", queueId)
    .single();
  if (!q) throw new Error("Элемент очереди не найден");

  // Learn the synonym (case-insensitive dedupe).
  const raw = (q.raw_service_name ?? "").trim();
  const { data: svc } = await sb
    .from("services_catalog")
    .select("synonyms")
    .eq("id", serviceId)
    .single();
  const syn: string[] = svc?.synonyms ?? [];
  if (raw && !syn.some((s) => s.toLowerCase() === raw.toLowerCase())) {
    await sb.from("services_catalog").update({ synonyms: [...syn, raw] }).eq("id", serviceId);
  }

  // Price comes from the raw extraction; clinic from the source.
  let price: number | null = null;
  let currency = "KZT";
  let duration: string | null = null;
  if (q.raw_extraction_id) {
    const { data: rx } = await sb
      .from("raw_extractions")
      .select("raw_price, raw_currency, raw_duration")
      .eq("id", q.raw_extraction_id)
      .single();
    if (rx) {
      price = rx.raw_price == null ? null : Number(rx.raw_price);
      currency = (rx.raw_currency ?? "KZT").toUpperCase();
      duration = rx.raw_duration;
    }
  }
  const { data: src } = await sb
    .from("sources")
    .select("default_clinic_id, url")
    .eq("id", q.source_id)
    .single();

  if (src?.default_clinic_id && price != null && !Number.isNaN(price)) {
    const kzt = currency === "USD" ? Math.round(price * FX_USD_KZT) : price;
    const { data: existing } = await sb
      .from("price_offers")
      .select("id")
      .eq("clinic_id", src.default_clinic_id)
      .eq("service_id", serviceId)
      .eq("source_id", q.source_id)
      .limit(1);
    if (!existing?.length) {
      const { data: off } = await sb
        .from("price_offers")
        .insert({
          clinic_id: src.default_clinic_id,
          service_id: serviceId,
          source_id: q.source_id,
          price: kzt,
          currency: "KZT",
          original_price: currency === "USD" ? price : null,
          original_currency: currency === "USD" ? "USD" : null,
          duration_days: durationDays(duration),
          raw_service_name: raw,
          source_url: src.url,
          is_active: true,
        })
        .select("id")
        .single();
      if (off) {
        await sb.from("price_history").insert({ price_offer_id: off.id, price: kzt, currency: "KZT" });
      }
    }
  }

  await sb
    .from("unmatched_queue")
    .update({ status: "resolved", resolved_service_id: serviceId, resolved_at: new Date().toISOString() })
    .eq("id", queueId);

  revalidatePath("/admin/ochered");
  revalidatePath("/admin");
}

export async function ignoreQueueItem(queueId: string) {
  const sb = createServerClient();
  await sb
    .from("unmatched_queue")
    .update({ status: "ignored", resolved_at: new Date().toISOString() })
    .eq("id", queueId);
  revalidatePath("/admin/ochered");
  revalidatePath("/admin");
}

export type AddSourceResult =
  | { ok: true; message: string }
  | { ok: false; conflict: true; message: string }
  | { ok: false; conflict: false; message: string };

// Quick exact-match duplicate guard (NOT content-similarity): warn if the URL already
// exists or a clinic with the same name+city exists, and let the admin force it through.
// The unique (clinic, service, source) constraint still prevents duplicate offer rows.
export async function addSource(formData: FormData, force = false): Promise<AddSourceResult> {
  const sb = createServerClient();
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim() || "Казахстан";
  const type = String(formData.get("source_type") ?? "html");
  if (!name || !url) return { ok: false, conflict: false, message: "Укажите название и URL" };

  if (!force) {
    const [{ data: dupUrl }, { data: dupClinic }] = await Promise.all([
      sb.from("sources").select("id, name").eq("url", url).limit(1),
      sb.from("clinics").select("id").eq("name", name).eq("city", city).limit(1),
    ]);
    if (dupUrl?.length) {
      return { ok: false, conflict: true, message: `Этот URL уже добавлен («${dupUrl[0].name}»). Добавить всё равно?` };
    }
    if (dupClinic?.length) {
      return {
        ok: false,
        conflict: true,
        message: `Клиника «${name}» в городе ${city} уже есть — источник привяжется к ней. Продолжить?`,
      };
    }
  }

  // Clinic deduped by (name, city); source deduped by url — same rules as the loader.
  const { data: clinics } = await sb
    .from("clinics")
    .select("id")
    .eq("name", name)
    .eq("city", city)
    .limit(1);
  let clinicId = clinics?.[0]?.id as string | undefined;
  if (!clinicId) {
    const { data: c } = await sb
      .from("clinics")
      .insert({ name, city, website_url: url, is_active: true })
      .select("id")
      .single();
    clinicId = c?.id;
  }

  const { data: srcs } = await sb.from("sources").select("id").eq("url", url).limit(1);
  if (!srcs?.length) {
    await sb
      .from("sources")
      .insert({ name, url, source_type: type, default_clinic_id: clinicId, is_active: true });
  }
  revalidatePath("/admin/istochniki");
  return { ok: true, message: "Источник добавлен" };
}

export async function runNow(sourceId: string) {
  const sb = createServerClient();
  await sb.from("parse_runs").insert({ source_id: sourceId, status: "queued", trigger: "manual" });
  revalidatePath("/admin/istochniki");
}

export async function toggleFlag(key: string, enabled: boolean) {
  const sb = createServerClient();
  await sb
    .from("feature_flags")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("key", key);
  revalidatePath("/admin/funkcii");
  revalidatePath("/poisk");
}
