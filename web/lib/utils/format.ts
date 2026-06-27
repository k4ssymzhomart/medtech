// Formatting helpers — Russian locale, KZT prices, freshness lifecycle.
// Design Law: no hyphens in UI copy; prices read as data.

/** Russian plural form: pluralizeRu(2, ["день","дня","дней"]) -> "дня". */
export function pluralizeRu(
  n: number,
  forms: [one: string, few: string, many: string],
): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

/** "12 500 ₸" — integer tenge, ru grouping, no decimals. */
export function formatPrice(value: number, currency = "KZT"): string {
  const n = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(
    Math.round(value),
  );
  return currency === "KZT" ? `${n} ₸` : `${n} ${currency}`;
}

// HARD LINE: never present an offer as current if last_seen_at is older than
// 30 days. Queries filter on this; the freshness badge reflects the rest.
export const CURRENT_OFFER_MAX_AGE_DAYS = 30;

export function isCurrentOffer(lastSeenAt: string | Date | null): boolean {
  if (!lastSeenAt) return false;
  const days = (Date.now() - new Date(lastSeenAt).getTime()) / 86_400_000;
  return days <= CURRENT_OFFER_MAX_AGE_DAYS;
}

export type Freshness = "fresh" | "stale" | "archived";

/** Lifecycle state from last_seen_at: fresh <7d, stale 7..30d, else archived. */
export function freshnessState(lastSeenAt: string | Date | null): Freshness {
  if (!lastSeenAt) return "archived";
  const last = new Date(lastSeenAt).getTime();
  const days = (Date.now() - last) / 86_400_000;
  if (days < 7) return "fresh";
  if (days <= 30) return "stale";
  return "archived";
}

/** "обновлено 2 дня назад" (no hyphens). */
export function formatFreshness(lastSeenAt: string | Date | null): string {
  if (!lastSeenAt) return "нет данных";
  const last = new Date(lastSeenAt).getTime();
  const days = Math.floor((Date.now() - last) / 86_400_000);
  if (days <= 0) return "обновлено сегодня";
  if (days === 1) return "обновлено вчера";
  return `обновлено ${days} ${pluralizeRu(days, ["день", "дня", "дней"])} назад`;
}
