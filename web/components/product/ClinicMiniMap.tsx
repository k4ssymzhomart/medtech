"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export function ClinicMiniMap({ lat, lng }: { lat: number; lng: number }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current || mapRef.current) return;
      const map = L.map(elRef.current, {
        scrollWheelZoom: false,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
      }).setView([lat, lng], 12);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      L.circleMarker([lat, lng], {
        radius: 8, color: "#0070F3", fillColor: "#0070F3", fillOpacity: 0.9, weight: 2,
      }).addTo(map);
    })();
    return () => {
      cancelled = true;
      const m = mapRef.current as { remove?: () => void } | null;
      if (m?.remove) m.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);

  return <div ref={elRef} className="h-44 w-full overflow-hidden rounded-[2px] border border-border" />;
}
