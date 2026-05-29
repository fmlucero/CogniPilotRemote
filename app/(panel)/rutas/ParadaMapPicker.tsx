"use client";

// HU-51 — Selector de ubicación de una parada en un mapa OpenStreetMap.
// Leaflet se carga por CDN (mismo patrón que FleetMap, sin dependencia npm).
// El usuario fija lat/lng haciendo click en el mapa, arrastrando el marcador,
// o buscando una dirección real (geocoding Nominatim de OSM). Cada cambio se
// reporta al form padre vía onPick.

import { useEffect, useRef, useState } from "react";

const MENDOZA: [number, number] = [-32.8895, -68.8458];

function parseLatLng(lat: string, lng: string): [number, number] {
  const la = Number(lat);
  const ln = Number(lng);
  if (Number.isFinite(la) && Number.isFinite(ln) && (la !== 0 || ln !== 0)) return [la, ln];
  return MENDOZA;
}

function ensureLeaflet(): Promise<void> {
  return new Promise((resolve) => {
    const w = window as typeof window & { L?: unknown };
    if (w.L) {
      resolve();
      return;
    }
    if (!document.querySelector("link[data-leaflet-css]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.dataset.leafletCss = "1";
      document.head.appendChild(link);
    }
    const existing = document.querySelector("script[data-leaflet-js]") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.leafletJs = "1";
    script.addEventListener("load", () => resolve(), { once: true });
    document.head.appendChild(script);
  });
}

export default function ParadaMapPicker({
  lat,
  lng,
  onPick,
  onClose,
}: {
  lat: string;
  lng: string;
  onPick: (lat: number, lng: number) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  // Centro inicial capturado una sola vez (el mapa es la fuente de verdad mientras está abierto).
  const initialRef = useRef<[number, number]>(parseLatLng(lat, lng));

  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);

  function place(la: number, ln: number, recenter: boolean) {
    const L = (window as typeof window & { L: any }).L; // eslint-disable-line @typescript-eslint/no-explicit-any
    const map = mapRef.current;
    if (!L || !map) return;
    const rounded = (n: number) => Math.round(n * 1e6) / 1e6;
    la = rounded(la);
    ln = rounded(ln);
    if (markerRef.current) {
      markerRef.current.setLatLng([la, ln]);
    }
    if (recenter) map.setView([la, ln], Math.max(map.getZoom(), 15));
    onPickRef.current(la, ln);
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    ensureLeaflet().then(() => {
      const L = (window as typeof window & { L: any }).L; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!L || !container || mapRef.current) return;
      const [la, ln] = initialRef.current;
      const map = L.map(container, { center: [la, ln], zoom: 14, scrollWheelZoom: true });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);
      const marker = L.marker([la, ln], { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        place(p.lat, p.lng, false);
      });
      map.on("click", (e: any) => place(e.latlng.lat, e.latlng.lng, false)); // eslint-disable-line @typescript-eslint/no-explicit-any
      setTimeout(() => map.invalidateSize(), 150);
      mapRef.current = map;
      markerRef.current = marker;
    });

    return () => {
      const map = mapRef.current;
      if (map) {
        map.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    setSearching(true);
    setSearchMsg(null);
    try {
      const url =
        "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ar&q=" +
        encodeURIComponent(q);
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data: Array<{ lat: string; lon: string; display_name: string }> = await res.json();
      if (data.length === 0) {
        setSearchMsg("Sin resultados para esa dirección");
        return;
      }
      place(Number(data[0].lat), Number(data[0].lon), true);
      setSearchMsg(data[0].display_name);
    } catch (err) {
      setSearchMsg("Error buscando: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSearching(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: ".5rem", marginTop: ".25rem" }}>
      <form onSubmit={doSearch} style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar dirección (ej. Av. San Martín 1234, Mendoza)"
          style={{
            flex: 1,
            padding: ".4rem .5rem",
            background: "var(--bg-elev)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            color: "var(--text)",
          }}
        />
        <button
          type="submit"
          disabled={searching}
          style={{ padding: ".4rem .8rem", background: "var(--bg-elev-2, var(--bg-elev))", color: "var(--accent)", border: "1px solid var(--border)", borderRadius: "4px", cursor: "pointer", fontFamily: "inherit", fontSize: ".82rem" }}
        >
          {searching ? "Buscando…" : "Buscar"}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{ padding: ".4rem .8rem", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "4px", cursor: "pointer", fontFamily: "inherit", fontSize: ".82rem" }}
        >
          Cerrar mapa
        </button>
      </form>
      <div style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>
        Click en el mapa o arrastrá el marcador para fijar la ubicación.
      </div>
      <div ref={containerRef} style={{ height: "320px", width: "100%", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border)" }} />
      {searchMsg && (
        <div style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>📍 {searchMsg}</div>
      )}
    </div>
  );
}
