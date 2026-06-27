"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { formatPrice } from "@/lib/utils/format";
import type { ServiceOffer } from "@/lib/queries/offers";

// Clinics are geocoded to city centre, so same-city pins share coords. Spread them with
// a small deterministic offset (≈1 km) keyed on the clinic id so they stay distinct.
function jitter(lat: number, lng: number, id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const a = ((h % 1000) / 1000 - 0.5) * 0.02;
  const b = (((h >> 10) % 1000) / 1000 - 0.5) * 0.02;
  return [lat + a, lng + b];
}

export function MapView({
  offers,
  minPrice,
  userLoc,
}: {
  offers: ServiceOffer[];
  minPrice: number | null;
  userLoc: { lat: number; lng: number } | null;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current || mapRef.current) return;
      const map = L.map(elRef.current, { scrollWheelZoom: false }).setView([48.0, 67.5], 5);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const pts: [number, number][] = [];
      for (const o of offers) {
        const c = o.clinic;
        if (!c || c.lat == null || c.lng == null) continue;
        const [lat, lng] = jitter(c.lat, c.lng, c.id);
        const best = minPrice != null && o.price === minPrice;
        const icon = L.divIcon({
          className: "",
          html: `<div class="price-pin${best ? " best" : ""}">${formatPrice(o.price)}</div>`,
          iconSize: [1, 1],
          iconAnchor: [0, 0],
        });
        const m = L.marker([lat, lng], { icon }).addTo(map);
        m.bindPopup(
          `<div style="font-weight:600">${c.name}</div>` +
            `<div style="color:#666">${[c.city, c.address].filter(Boolean).join(", ") || ""}</div>` +
            `<div style="margin:4px 0;font-weight:700">${formatPrice(o.price)}</div>` +
            `<a href="/klinika/${c.id}">Открыть клинику</a>`,
        );
        pts.push([lat, lng]);
      }

      if (userLoc) {
        L.circleMarker([userLoc.lat, userLoc.lng], {
          radius: 7, color: "#0070F3", fillColor: "#0070F3", fillOpacity: 0.9, weight: 2,
        }).addTo(map).bindPopup("Вы здесь");
        pts.push([userLoc.lat, userLoc.lng]);
      }
      if (pts.length) map.fitBounds(pts, { padding: [44, 44], maxZoom: 13 });
    })();

    return () => {
      cancelled = true;
      const m = mapRef.current as { remove?: () => void } | null;
      if (m && m.remove) m.remove();
      mapRef.current = null;
    };
  }, [offers, minPrice, userLoc]);

  return <div ref={elRef} className="h-[600px] w-full overflow-hidden rounded-[2px] border border-border" />;
}
