"use client";

// HU-11 + HU-26 — Mapa de flota reusable.
// Consume /api/realtime/positions (scope por rol lo aplica el back) y renderiza
// markers por repartidor en Leaflet. Polling cada 10s por default.
// Renderiza la admin-card completa (header + map + legend).

import { useEffect, useRef, useState } from "react";

export interface FleetPosition {
  usuarioId: string;
  usuarioNombre: string;
  usuarioEmail: string;
  empresaId: string | null;
  empresaNombre: string | null;
  dispositivoId: string;
  deviceUuid: string;
  lat: number;
  lng: number;
  lastSeen: number;
  connectionState: "online" | "active_today" | "offline";
}

const FLEET_STATE_COLOR: Record<FleetPosition["connectionState"], string> = {
  online: "#6ed28a",
  active_today: "#f5a524",
  offline: "#5f5f63",
};
const FLEET_STATE_LABEL: Record<FleetPosition["connectionState"], string> = {
  online: "en línea",
  active_today: "activo hoy",
  offline: "desconectado",
};

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

function ago(ms: number) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  return Math.floor(s / 3600) + "h";
}

export default function FleetMap({
  title = "🗺️ Mapa de la flota",
  pollMs = 10_000,
  showHeader = true,
  defaultCenter = [-34.6, -68.5] as [number, number],
  defaultZoom = 7,
}: {
  title?: string;
  pollMs?: number;
  showHeader?: boolean;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [mapReady, setMapReady] = useState(false);
  const [fleet, setFleet] = useState<FleetPosition[]>([]);
  const [fleetError, setFleetError] = useState(false);

  // Polling
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/realtime/positions", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data: { positions: FleetPosition[]; serverTime: number } = await res.json();
        if (alive) {
          setFleet(data.positions);
          setFleetError(false);
        }
      } catch (err) {
        if (alive) setFleetError(true);
        console.warn("fleet poll error", err);
      }
    }
    poll();
    const id = window.setInterval(poll, pollMs);
    return () => { alive = false; window.clearInterval(id); };
  }, [pollMs]);

  // Init mapa (una sola vez)
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    if (container.dataset.ready === "1") return;

    function ensureLeaflet(): Promise<void> {
      return new Promise((resolve) => {
        const w = window as typeof window & { L?: unknown };
        if (w.L) { resolve(); return; }
        if (!document.querySelector("link[data-leaflet-css]")) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          link.dataset.leafletCss = "1";
          document.head.appendChild(link);
        }
        const existing = document.querySelector("script[data-leaflet-js]") as HTMLScriptElement | null;
        if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); return; }
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.async = true;
        script.dataset.leafletJs = "1";
        script.addEventListener("load", () => resolve(), { once: true });
        document.head.appendChild(script);
      });
    }

    ensureLeaflet().then(() => {
      const L = (window as typeof window & { L: any }).L; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!L || !container) return;
      container.dataset.ready = "1";
      const map = L.map(container, {
        center: defaultCenter, zoom: defaultZoom,
        scrollWheelZoom: false, attributionControl: true,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 18, subdomains: "abcd",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);
      setTimeout(() => map.invalidateSize(), 200);
      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      const map = mapRef.current;
      if (map) {
        markersRef.current.forEach((m) => map.removeLayer(m));
        markersRef.current = [];
        map.remove();
        if (container) container.dataset.ready = "";
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, [defaultCenter, defaultZoom]);

  // Sync markers
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const L = (window as typeof window & { L: any }).L; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!L) return;

    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    fleet.forEach((p) => {
      const color = FLEET_STATE_COLOR[p.connectionState];
      const icon = L.divIcon({
        className: "fleet-marker",
        html: '<span class="fleet-marker-pulse" style="background:' + color + '"></span>'
            + '<span class="fleet-marker-dot" style="background:' + color + '"></span>',
        iconSize: [22, 22], iconAnchor: [11, 11],
      });
      const popupHtml =
        '<strong>' + escapeHtml(p.usuarioNombre) + '</strong>'
        + (p.empresaNombre ? ' — <span style="color:#8c8c92">' + escapeHtml(p.empresaNombre) + '</span>' : '')
        + '<br><span style="color:#8c8c92">' + FLEET_STATE_LABEL[p.connectionState] + ' · hace ' + ago(p.lastSeen) + '</span>';
      const marker = L.marker([p.lat, p.lng], { icon }).addTo(map).bindPopup(popupHtml);
      markersRef.current.push(marker);
    });

    if (fleet.length > 0) {
      const bounds = L.latLngBounds(fleet.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
  }, [fleet, mapReady]);

  return (
    <div className="admin-card map-card">
      {showHeader && (
        <div className="card-header map-header">
          <h2>{title}</h2>
          <span className="map-meta map-meta-live">
            <span className="live-dot" />
            {fleetError
              ? "error refrescando"
              : fleet.length === 0
                ? "sin posiciones en 24h"
                : `${fleet.length} repartidor${fleet.length === 1 ? "" : "es"} · refresco ${pollMs / 1000}s`}
          </span>
        </div>
      )}
      <div ref={mapContainerRef} className="fleet-map" />
      <ul className="map-legend">
        <li><span className="legend-dot ok" /> En línea (&lt;5 min)</li>
        <li><span className="legend-dot warn" /> Activo hoy (&lt;24 h)</li>
        <li><span className="legend-dot off" /> Desconectado</li>
      </ul>
    </div>
  );
}
