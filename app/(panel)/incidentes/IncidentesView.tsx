"use client";

// HU-13 — Tabla filtrable de incidentes (eventos críticos del sidecar Android).
// HU-37 — Botón "Descargar CSV" con los filtros aplicados.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const INCIDENT_TYPES = ["scan_detected", "user_continued", "warning_shown"] as const;
type IncidentType = typeof INCIDENT_TYPES[number];

const TYPE_LABEL: Record<IncidentType, string> = {
  scan_detected: "Escaneo detectado",
  user_continued: "Continuó igual",
  warning_shown: "Warning mostrado",
};
const TYPE_PILL: Record<IncidentType, string> = {
  scan_detected: "pill-off",     // rojo
  user_continued: "pill-off",    // rojo
  warning_shown: "pill-warn",    // ámbar
};
const TYPE_ICON: Record<IncidentType, string> = {
  scan_detected: "🚫",
  user_continued: "⚠️",
  warning_shown: "🟠",
};

type Rol = "admin_sistema" | "supervisor" | "gerente" | "repartidor";

interface FeedEvent {
  id?: string;
  type: string;
  timestamp: number;
  inSchedule?: boolean;
  screenName?: string;
  appPackage?: string;
  keywords?: string[];
  screenText?: string[];
  usuarioId?: string | null;
  usuarioEmail?: string | null;
  usuarioNombre?: string | null;
  empresaId?: string | null;
  empresaNombre?: string | null;
}

type Window = "24h" | "7d" | "30d" | "all";
const WINDOW_LABEL: Record<Window, string> = { "24h": "Hoy", "7d": "7 días", "30d": "30 días", all: "Todo" };
const WINDOW_DAYS: Record<Window, number | null> = { "24h": 1, "7d": 7, "30d": 30, all: null };

function rangeFrom(win: Window): { from: number | null; to: number } {
  const to = Date.now();
  const days = WINDOW_DAYS[win];
  return { from: days === null ? null : to - days * 86400_000, to };
}

function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export default function IncidentesView({ viewerRol }: { viewerRol: Rol }) {
  const [window, setWindow] = useState<Window>("7d");
  const [selectedTypes, setSelectedTypes] = useState<Set<IncidentType>>(new Set(INCIDENT_TYPES));
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tipoParam = useMemo(() => Array.from(selectedTypes).join(","), [selectedTypes]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { from, to } = rangeFrom(window);
        const qs = new URLSearchParams({ tipo: tipoParam, to: String(to) });
        if (from !== null) qs.set("from", String(from));
        const res = await fetch(`/api/events?${qs.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data: { events: FeedEvent[] } = await res.json();
        if (alive) setEvents(data.events);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    if (selectedTypes.size > 0) load();
    else { setEvents([]); setLoading(false); }
    return () => { alive = false; };
  }, [window, tipoParam, selectedTypes.size]);

  function toggleType(t: IncidentType) {
    const next = new Set(selectedTypes);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setSelectedTypes(next);
  }

  function downloadCsv() {
    const { from, to } = rangeFrom(window);
    const qs = new URLSearchParams({ tipo: tipoParam, to: String(to) });
    if (from !== null) qs.set("from", String(from));
    const url = `/api/reportes/eventos.csv?${qs.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Más recientes primero
  const ordered = useMemo(() => [...events].sort((a, b) => b.timestamp - a.timestamp), [events]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Incidentes</h2>
          <div className="page-subtitle">
            {viewerRol === "admin_sistema"
              ? "Eventos críticos del sidecar Android — todas las empresas"
              : "Eventos críticos del sidecar Android — tu empresa"}
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="admin-card" style={{ padding: ".75rem 1.25rem", marginBottom: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
          <span style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Rango:</span>
          {(Object.keys(WINDOW_LABEL) as Window[]).map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              style={{
                padding: ".25rem .7rem",
                fontSize: ".82rem",
                border: "1px solid " + (window === w ? "var(--accent)" : "var(--border)"),
                background: window === w ? "var(--accent)" : "transparent",
                color: window === w ? "#000" : "var(--text-muted)",
                borderRadius: "4px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {WINDOW_LABEL[w]}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
          <span style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Tipo:</span>
          {INCIDENT_TYPES.map((t) => {
            const on = selectedTypes.has(t);
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                style={{
                  padding: ".25rem .65rem",
                  fontSize: ".8rem",
                  border: "1px solid " + (on ? "var(--accent)" : "var(--border)"),
                  background: on ? "var(--accent)" : "transparent",
                  color: on ? "#000" : "var(--text-muted)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {TYPE_ICON[t]} {TYPE_LABEL[t]}
              </button>
            );
          })}
        </div>

        <button
          onClick={downloadCsv}
          disabled={selectedTypes.size === 0}
          style={{
            marginLeft: "auto",
            padding: ".4rem .9rem",
            fontSize: ".82rem",
            border: "1px solid var(--accent)",
            background: "var(--accent)",
            color: "#000",
            borderRadius: "4px",
            cursor: selectedTypes.size === 0 ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            fontWeight: 600,
            opacity: selectedTypes.size === 0 ? 0.5 : 1,
          }}
        >
          ⬇ Descargar CSV
        </button>
      </div>

      {error && (
        <div className="admin-card" style={{ padding: ".75rem 1rem", marginBottom: "1rem", borderLeft: "3px solid var(--error)", color: "var(--error)" }}>
          ⚠️ Error cargando incidentes: {error}
        </div>
      )}

      <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
        <div className="card-header" style={{ marginBottom: ".75rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>Lista ({loading ? "…" : ordered.length})</h2>
          {selectedTypes.size === 0 && (
            <span style={{ fontSize: ".78rem", color: "var(--warning)" }}>Seleccioná al menos un tipo arriba</span>
          )}
        </div>

        {ordered.length === 0 && !loading ? (
          <div className="empty-state">
            <strong>Sin incidentes en el rango seleccionado</strong>
            Probá ampliar el rango o seleccionar más tipos.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Repartidor</th>
                  <th>Empresa</th>
                  <th>Pantalla / app</th>
                  <th>En horario</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((e) => {
                  const t = e.type as IncidentType;
                  return (
                    <tr key={e.id ?? e.timestamp}>
                      <td className="muted">{fmtDateTime(e.timestamp)}</td>
                      <td>
                        <span className={`pill ${TYPE_PILL[t] ?? "pill-off"}`}>
                          {TYPE_ICON[t] ?? "•"} {TYPE_LABEL[t] ?? e.type}
                        </span>
                      </td>
                      <td>
                        {e.usuarioId ? (
                          <Link href={`/usuarios/${e.usuarioId}`} className="row-link">
                            <strong>{e.usuarioNombre ?? "—"}</strong>
                          </Link>
                        ) : (
                          <span className="muted">(anónimo)</span>
                        )}
                      </td>
                      <td className="muted">{e.empresaNombre ?? "—"}</td>
                      <td className="muted">
                        {e.screenName ?? "—"}
                        {e.appPackage && <span style={{ fontSize: ".78rem", display: "block", color: "var(--text-faint)" }}>{e.appPackage}</span>}
                      </td>
                      <td>
                        {e.inSchedule === true ? (
                          <span className="pill pill-on">Sí</span>
                        ) : e.inSchedule === false ? (
                          <span className="pill pill-off">Fuera</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
