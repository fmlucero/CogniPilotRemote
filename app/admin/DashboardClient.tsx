"use client";

/**
 * Client Component que monta:
 *   - El form de schedule (con submit handler)
 *   - El polling de eventos + KPIs
 *   - El feed de actividad en vivo
 *   - El mapa Leaflet de la flota
 *
 * Antes esto vivía en <script dangerouslySetInnerHTML> dentro del Server
 * Component. Con soft navigation (next/link), los scripts inline NO se vuelven
 * a ejecutar, así que al volver al Dashboard desde otra sección los KPIs
 * quedaban en 0 y los handlers del form perdidos hasta hacer F5.
 *
 * Convertido a useEffect / event handlers React → corre en cada mount,
 * sin importar si la llegada fue full reload o soft nav. Cleanup en unmount.
 */

import { useEffect, useRef, useState } from "react";

export interface ScheduleFromBack {
  enabled: boolean;
  from: string | null;
  to: string | null;
  tz: string | null;
  updatedAt: number | null;
  updatedBy: string | null;
}

type EventType =
  | "app_opened" | "warning_shown" | "scan_detected"
  | "user_continued" | "user_cancelled"
  | "global_app_opened" | "global_clicked";

interface FeedEvent {
  id?: string;
  type: EventType | string;
  timestamp: number;
  inSchedule?: boolean;
  screenName?: string;
  appPackage?: string;
  keywords?: string[];
  screenText?: string[];
}

const SCAN_ALERT_WINDOW_MS = 30_000;
const FEED_LIMIT = 30;
const POLL_INTERVAL_MS = 1500;

const LABELS: Record<string, { icon: string; text: string; cls: string }> = {
  app_opened:        { icon: "🚚", text: "App abierta",                       cls: "ev-info" },
  warning_shown:     { icon: "🟠", text: "Cartel naranja",                    cls: "ev-warn" },
  scan_detected:     { icon: "🚫", text: "Cartel rojo (escaneo detectado)",   cls: "ev-danger" },
  user_continued:    { icon: "⚠️", text: "Usuario continuó igual",            cls: "ev-danger" },
  user_cancelled:    { icon: "✅", text: "Usuario canceló",                    cls: "ev-success" },
  global_app_opened: { icon: "📱", text: "App externa abierta",                cls: "ev-global" },
  global_clicked:    { icon: "👆", text: "Click externo",                      cls: "ev-global" },
};

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString("es-AR", { hour12: false });
}

function ago(ms: number) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  return Math.floor(s / 3600) + "h";
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

export default function DashboardClient({
  initialSchedule, lastUpdate,
}: {
  initialSchedule: ScheduleFromBack | null;
  lastUpdate: string | null;
}) {
  // ─── Schedule form state ─────────────────────────────────────────────
  const [enabled, setEnabled] = useState(initialSchedule?.enabled ?? false);
  const [from, setFrom] = useState(initialSchedule?.from ?? "08:00");
  const [to, setTo] = useState(initialSchedule?.to ?? "18:00");
  const [tz, setTz] = useState(initialSchedule?.tz ?? "America/Argentina/Buenos_Aires");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "warning" | "error"; text: string } | null>(null);

  // ─── Live stats state ────────────────────────────────────────────────
  const [counters, setCounters] = useState({
    app_opened: 0, scan_detected: 0, user_continued: 0, user_cancelled: 0,
  });
  const [pollError, setPollError] = useState(false);

  const feedRef = useRef<HTMLUListElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const alertTitleRef = useRef<HTMLElement>(null);
  const alertSubtitleRef = useRef<HTMLElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // ─── Submit schedule ─────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, from: from || "00:00", to: to || "00:00", tz }),
      });
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (res.ok) {
        setFeedback({
          kind: "success",
          text: "✅ Horario guardado. La app del repartidor se sincroniza por SSE (instantáneo en foreground) o polling (≤30s/15min).",
        });
      } else {
        const data = await res.json().catch(() => ({} as { error?: string }));
        setFeedback({ kind: "warning", text: "⚠️ Error al guardar: " + (data.error || ("HTTP " + res.status)) });
      }
    } catch (err) {
      setFeedback({
        kind: "error",
        text: "❌ Error de red: " + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 6000);
    }
  }

  // ─── Polling de eventos + render del feed ────────────────────────────
  useEffect(() => {
    const eventBuffer: FeedEvent[] = [];
    let lastSeen = 0;
    let alive = true;
    const localCounters = { app_opened: 0, scan_detected: 0, user_continued: 0, user_cancelled: 0 };

    function refreshBanner() {
      const banner = bannerRef.current;
      const aTitle = alertTitleRef.current;
      const aSub = alertSubtitleRef.current;
      if (!banner || !aTitle || !aSub) return;
      const lastScan = [...eventBuffer].reverse().find((e) => e.type === "scan_detected");
      if (!lastScan) { banner.className = "alert-banner hidden"; return; }
      const elapsed = Date.now() - lastScan.timestamp;
      if (elapsed > SCAN_ALERT_WINDOW_MS) { banner.className = "alert-banner hidden"; return; }
      const inSched = lastScan.inSchedule === false
        ? "fuera de horario"
        : (lastScan.inSchedule === true ? "dentro de horario" : "");
      aTitle.textContent = "🚨 Cartel rojo activo en el dispositivo";
      aSub.textContent = (inSched ? inSched + " · " : "") + "hace " + ago(lastScan.timestamp);
      banner.className = "alert-banner";
      banner.style.marginBottom = "1.5rem";
    }

    function renderFeed() {
      const feed = feedRef.current;
      if (!feed) return;
      if (eventBuffer.length === 0) {
        feed.innerHTML = '<li class="event-empty">Esperando eventos del dispositivo…</li>';
        return;
      }
      const recent = eventBuffer.slice(-FEED_LIMIT).reverse();
      feed.innerHTML = recent.map((e) => {
        const meta = LABELS[e.type] || { icon: "•", text: e.type, cls: "" };
        const detail: string[] = [];
        if (e.appPackage) detail.push(escapeHtml(e.appPackage));
        if (e.screenName) detail.push(escapeHtml(e.screenName));
        if (e.keywords && e.keywords.length) detail.push(escapeHtml(e.keywords.join(", ")));
        if (typeof e.inSchedule === "boolean") detail.push(e.inSchedule ? "en horario" : "fuera de horario");
        const detailHtml = detail.length ? '<span class="event-meta">' + detail.join(" · ") + "</span>" : "";
        const textsHtml = (e.screenText && e.screenText.length)
          ? '<span class="event-texts">' + e.screenText.slice(0, 5).map((t) => '<span class="chip">' + escapeHtml(t) + "</span>").join("") + "</span>"
          : "";
        return '<li class="event-row ' + meta.cls + '">'
          + '<span class="event-icon">' + meta.icon + "</span>"
          + '<div class="event-body">'
            + '<span class="event-title">' + meta.text + "</span>"
            + detailHtml + textsHtml
          + "</div>"
          + '<span class="event-time">' + fmtTime(e.timestamp) + "</span>"
          + "</li>";
      }).join("");
    }

    function ingest(events: FeedEvent[]) {
      if (!events || !events.length) return;
      for (const e of events) {
        eventBuffer.push(e);
        const k = e.type as keyof typeof localCounters;
        if (localCounters[k] !== undefined) localCounters[k]++;
        if (e.timestamp > lastSeen) lastSeen = e.timestamp;
      }
      if (eventBuffer.length > 200) eventBuffer.splice(0, eventBuffer.length - 200);
      renderFeed();
      refreshBanner();
      setCounters({ ...localCounters });
    }

    async function poll() {
      if (!alive) return;
      try {
        const url = lastSeen ? "/api/events?since=" + lastSeen : "/api/events";
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        ingest(data.events || []);
        setPollError(false);
      } catch (err) {
        setPollError(true);
        console.warn("live poll error", err);
      }
    }

    poll();
    const pollTimer = window.setInterval(poll, POLL_INTERVAL_MS);
    const bannerTimer = window.setInterval(refreshBanner, 1000);
    return () => {
      alive = false;
      window.clearInterval(pollTimer);
      window.clearInterval(bannerTimer);
    };
  }, []);

  // ─── Leaflet map ─────────────────────────────────────────────────────
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    if (container.dataset.ready === "1") return;

    const STATUS_COLOR: Record<string, string> = { ok: "#6ed28a", warn: "#f5a524", off: "#5f5f63" };
    const vehicles = [
      { id: "MZA-01", label: "Unidad 01", lat: -34.6177, lng: -68.3301, status: "ok", note: "San Rafael · en ruta" },
    ];
    let mapInstance: { invalidateSize: () => void; remove: () => void } | null = null;

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
        center: [-34.6177, -68.3301], zoom: 12,
        scrollWheelZoom: false, attributionControl: true,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 18, subdomains: "abcd",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);
      vehicles.forEach((v) => {
        const color = STATUS_COLOR[v.status] || "#ffe14d";
        const icon = L.divIcon({
          className: "fleet-marker",
          html: '<span class="fleet-marker-pulse" style="background:' + color + '"></span>'
              + '<span class="fleet-marker-dot" style="background:' + color + '"></span>',
          iconSize: [22, 22], iconAnchor: [11, 11],
        });
        L.marker([v.lat, v.lng], { icon }).addTo(map)
          .bindPopup('<strong>' + v.id + '</strong> — ' + v.label + '<br><span style="color:#8c8c92">' + v.note + "</span>");
      });
      setTimeout(() => map.invalidateSize(), 200);
      mapInstance = map;
    });

    return () => {
      if (mapInstance) {
        mapInstance.remove();
        if (container) container.dataset.ready = "";
      }
    };
  }, []);

  return (
    <>
      {/* Banner */}
      <div ref={bannerRef} className="alert-banner hidden" role="alert" style={{ marginBottom: "1.5rem" }}>
        <div className="alert-banner-icon">🚨</div>
        <div className="alert-banner-body">
          <strong ref={alertTitleRef as React.RefObject<HTMLElement>}>Escaneo detectado fuera de horario</strong>
          <span ref={alertSubtitleRef as React.RefObject<HTMLElement>} className="alert-subtitle">—</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-row">
        <div className="kpi-card kpi-info">
          <span className="kpi-label">Aperturas</span>
          <span className="kpi-value">{counters.app_opened}</span>
        </div>
        <div className="kpi-card kpi-warn">
          <span className="kpi-label">Cartel rojo</span>
          <span className="kpi-value">{counters.scan_detected}</span>
        </div>
        <div className="kpi-card kpi-danger">
          <span className="kpi-label">Continuó igual</span>
          <span className="kpi-value">{counters.user_continued}</span>
        </div>
        <div className="kpi-card kpi-success">
          <span className="kpi-label">Canceló</span>
          <span className="kpi-value">{counters.user_cancelled}</span>
        </div>
      </div>

      {/* Fila principal: 5/12 schedule | 7/12 mapa */}
      <div className="grid">
        <div className="col-5 col-stack">
          <div className="admin-card">
            <div className="card-header">
              <h2>⏰ Horario permitido</h2>
              {lastUpdate && (
                <p className="last-update">
                  Última actualización: <strong>{lastUpdate}</strong>
                  {initialSchedule?.updatedBy && <> por <strong>{initialSchedule.updatedBy}</strong></>}
                </p>
              )}
            </div>

            {feedback && (
              <div className={`feedback ${feedback.kind}`} role="alert">
                {feedback.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="schedule-form">
              <div className="toggle-row">
                <label className="toggle-label" htmlFor="enabled-toggle">
                  <span>Restricción horaria activa</span>
                  <div className="toggle-wrapper">
                    <input
                      id="enabled-toggle"
                      type="checkbox"
                      role="switch"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                    />
                    <span className="toggle-track"><span className="toggle-thumb" /></span>
                  </div>
                </label>
              </div>

              <div className="time-fields" style={{ display: enabled ? "grid" : "none" }}>
                <div className="field-group">
                  <label htmlFor="from-input">Desde</label>
                  <input id="from-input" type="time" value={from} onChange={(e) => setFrom(e.target.value)} required />
                </div>
                <div className="field-group">
                  <label htmlFor="to-input">Hasta</label>
                  <input id="to-input" type="time" value={to} onChange={(e) => setTo(e.target.value)} required />
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="tz-select">Zona horaria</label>
                <select id="tz-select" value={tz} onChange={(e) => setTz(e.target.value)}>
                  <option value="America/Argentina/Buenos_Aires">Argentina (ART, UTC-3)</option>
                  <option value="America/Sao_Paulo">Brasil - São Paulo (BRT, UTC-3)</option>
                  <option value="America/Santiago">Chile (CLT, UTC-4/-3)</option>
                  <option value="America/Bogota">Colombia (COT, UTC-5)</option>
                  <option value="America/Lima">Perú (PET, UTC-5)</option>
                  <option value="America/Mexico_City">México (CST/CDT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div className="action-row">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Guardando…" : "💾 Guardar"}
                </button>
              </div>
            </form>
          </div>

          <div className="admin-card info-card">
            <h3>📡 Estado del sistema</h3>
            <ul className="status-list">
              <li><span className="dot green" /> App Android sincroniza por <strong>SSE</strong> en foreground (latencia &lt;100ms)</li>
              <li><span className="dot green" /> Polling 30s en foreground + WorkManager 15 min en background como fallback</li>
              <li><span className="dot green" /> Backend FastAPI (cognipilot-back) operativo en VM UM-Cloud</li>
            </ul>
          </div>
        </div>

        <div className="col-7 col-stack">
          <div className="admin-card map-card">
            <div className="card-header map-header">
              <h2>🗺️ Mapa de la flota — Mendoza</h2>
              <span className="map-meta map-meta-live"><span className="live-dot" /> Datos en vivo</span>
            </div>
            <div ref={mapContainerRef} className="fleet-map" />
            <ul className="map-legend">
              <li><span className="legend-dot ok" /> En ruta</li>
              <li><span className="legend-dot warn" /> Detenido</li>
              <li><span className="legend-dot off" /> Fuera de servicio</li>
            </ul>
          </div>

          <div className="admin-card live-card">
            <div className="card-header live-header">
              <h2>📊 Actividad en vivo</h2>
              <span className={"live-status" + (pollError ? " error" : "")}>
                <span className="dot pulse" /> {pollError ? "error en polling" : "escuchando…"}
              </span>
            </div>
            <ul ref={feedRef} className="event-feed">
              <li className="event-empty">Esperando eventos del dispositivo…</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
