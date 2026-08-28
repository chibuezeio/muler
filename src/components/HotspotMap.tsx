"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

export type Hotspot = {
  lat: number;
  lng: number;
  total: number;
  likelyFake: number;
  cleared: number;
  riskRatio: number;
  productIds: string[];
};

type Props = {
  hotspots: Hotspot[];
};

export function HotspotMap({ hotspots }: Props) {
  const center: [number, number] =
    hotspots.length > 0
      ? [hotspots[0].lat, hotspots[0].lng]
      : [6.5244, 3.3792];

  return (
    <div className="h-[380px] w-full overflow-hidden rounded-lg border border-teal/20">
      <MapContainer
        center={center}
        zoom={6}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hotspots.map((h) => (
          <CircleMarker
            key={`${h.lat}-${h.lng}`}
            center={[h.lat, h.lng]}
            radius={8 + Math.min(h.total, 20)}
            pathOptions={{
              color: h.likelyFake > 0 ? "#b42318" : "#0d6e6e",
              fillColor: h.likelyFake > 0 ? "#b42318" : "#0d6e6e",
              fillOpacity: 0.45,
            }}
          >
            <Popup>
              <div className="text-sm">
                <p>
                  <strong>{h.total}</strong> scans ·{" "}
                  <strong>{h.likelyFake}</strong> likely fake
                </p>
                <p>Risk ratio: {(h.riskRatio * 100).toFixed(0)}%</p>
                {h.productIds.length > 0 && (
                  <p className="mt-1 text-xs">{h.productIds.join(", ")}</p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
