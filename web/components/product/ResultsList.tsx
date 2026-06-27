"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Clock, ExternalLink, GitCompareArrows, Navigation, LocateFixed } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  formatPrice,
  formatFreshness,
  freshnessState,
  pluralizeRu,
} from "@/lib/utils/format";
import type { ServiceOffer } from "@/lib/queries/offers";

function turnaround(days: number | null): string | null {
  if (!days || days <= 0) return null;
  return `результат за ${days} ${pluralizeRu(days, ["день", "дня", "дней"])}`;
}

// Haversine distance in km.
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function ResultsList({
  offers,
  minPrice,
  serviceSlug,
  distanceEnabled = false,
  sort = "price_asc",
}: {
  offers: ServiceOffer[];
  minPrice: number | null;
  serviceSlug: string;
  distanceEnabled?: boolean;
  sort?: string;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "asking" | "denied">("idle");

  function locate() {
    if (!("geolocation" in navigator)) return setGeoState("denied");
    setGeoState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState("idle");
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  // Attach distance, then optionally re-sort by it (server handles price sorts).
  const view = useMemo(() => {
    const withDist = offers.map((o) => {
      const c = o.clinic;
      const km =
        userLoc && c?.lat != null && c?.lng != null
          ? distanceKm(userLoc, { lat: c.lat, lng: c.lng })
          : null;
      return { o, km };
    });
    if (sort === "distance" && userLoc) {
      withDist.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
    }
    return withDist;
  }, [offers, userLoc, sort]);

  const compareHref = useMemo(() => {
    const p = new URLSearchParams();
    p.set("service", serviceSlug);
    p.set("clinics", picked.join(","));
    return `/sravnenie?${p.toString()}`;
  }, [picked, serviceSlug]);

  function toggle(clinicId: string) {
    setPicked((cur) =>
      cur.includes(clinicId)
        ? cur.filter((x) => x !== clinicId)
        : cur.length >= 4
          ? cur
          : [...cur, clinicId],
    );
  }

  return (
    <div className="relative">
      {distanceEnabled && (
        <div className="mb-3 flex items-center gap-3 text-sm">
          <button
            onClick={locate}
            className="inline-flex h-8 items-center gap-1.5 rounded-[2px] border border-border px-3 hover:border-foreground"
          >
            <LocateFixed size={14} />
            {userLoc ? "Местоположение определено" : "Рядом со мной"}
          </button>
          {geoState === "asking" && <span className="text-muted">определяем…</span>}
          {geoState === "denied" && <span className="text-muted">не удалось определить геолокацию</span>}
        </div>
      )}

      <ul className="space-y-2">
        {view.map(({ o, km }) => {
          const isBest = minPrice != null && o.price === minPrice;
          const fresh = freshnessState(o.last_seen_at);
          const t = turnaround(o.duration_days);
          const clinic = o.clinic!;
          const checked = picked.includes(clinic.id);
          return (
            <li
              key={o.id}
              className={`flex items-stretch justify-between gap-4 rounded-[2px] border bg-background p-4 transition-colors ${
                isBest ? "border-accent" : "border-border hover:border-foreground"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/klinika/${clinic.id}`}
                    className="truncate text-[15px] font-semibold hover:text-accent"
                  >
                    {clinic.name}
                  </Link>
                  {isBest && <Badge variant="best">Лучшая цена</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} />
                    {[clinic.city, clinic.address].filter(Boolean).join(", ") || "город не указан"}
                  </span>
                  {km != null && (
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <Navigation size={12} />
                      {km < 1 ? "меньше 1 км" : `${km.toFixed(km < 10 ? 1 : 0)} км`}
                    </span>
                  )}
                  {t && (
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} />
                      {t}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <Badge variant={fresh === "fresh" ? "fresh" : "stale"}>
                    {formatFreshness(o.last_seen_at)}
                  </Badge>
                  {o.source_url && (
                    <a
                      href={o.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-2 hover:text-foreground"
                    >
                      источник <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end justify-between">
                <span className="numeric text-xl font-bold tabular-nums">
                  {formatPrice(o.price)}
                </span>
                <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(clinic.id)}
                    className="h-3.5 w-3.5 accent-[var(--accent,#0070F3)]"
                  />
                  сравнить
                </label>
              </div>
            </li>
          );
        })}
      </ul>

      {picked.length >= 2 && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between gap-4 rounded-[2px] border border-accent bg-background p-3">
          <span className="text-sm">Выбрано клиник: {picked.length}</span>
          <Link
            href={compareHref}
            className="inline-flex h-9 items-center gap-2 rounded-[2px] bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
          >
            <GitCompareArrows size={15} />
            Сравнить
          </Link>
        </div>
      )}
    </div>
  );
}
