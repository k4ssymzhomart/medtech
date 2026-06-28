"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { List, Map as MapIcon, LocateFixed, Share2, Check } from "lucide-react";
import { ResultsList } from "@/components/product/ResultsList";
import type { ServiceOffer } from "@/lib/queries/offers";

// Map is client-only (Leaflet touches window) — load without SSR.
const MapView = dynamic(() => import("@/components/product/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-[600px] w-full items-center justify-center rounded-[2px] border border-border text-sm text-muted">
      загрузка карты…
    </div>
  ),
});

export function ResultsView({
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
  const [view, setView] = useState<"list" | "map">("list");
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "asking" | "denied">("idle");
  const [shared, setShared] = useState(false);

  function share() {
    navigator.clipboard?.writeText(window.location.href).then(
      () => {
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      },
      () => {},
    );
  }

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

  const tab = (v: "list" | "map", icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setView(v)}
      className={`inline-flex h-8 items-center gap-1.5 rounded-[2px] border px-3 text-sm transition-colors ${
        view === v ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {tab("list", <List size={14} />, "Список")}
          {tab("map", <MapIcon size={14} />, "Карта")}
        </div>
        <div className="flex items-center gap-2 text-sm">
          {distanceEnabled && (
            <>
              <button
                onClick={locate}
                className="inline-flex h-8 items-center gap-1.5 rounded-[2px] border border-border px-3 hover:border-foreground"
              >
                <LocateFixed size={14} />
                {userLoc ? "Местоположение определено" : "Рядом со мной"}
              </button>
              {geoState === "asking" && <span className="text-muted">определяем…</span>}
              {geoState === "denied" && <span className="text-muted">геолокация недоступна</span>}
            </>
          )}
          <button
            onClick={share}
            className="inline-flex h-8 items-center gap-1.5 rounded-[2px] border border-border px-3 hover:border-foreground"
          >
            {shared ? <Check size={14} className="text-success" /> : <Share2 size={14} />}
            {shared ? "Скопировано" : "Поделиться"}
          </button>
        </div>
      </div>

      {view === "list" ? (
        <ResultsList
          offers={offers}
          minPrice={minPrice}
          serviceSlug={serviceSlug}
          userLoc={userLoc}
          sort={sort}
        />
      ) : (
        <MapView offers={offers} minPrice={minPrice} userLoc={userLoc} />
      )}
    </div>
  );
}
