"use client";

// HU-36 — Tabla filtrable de auditoría (admin_sistema only).
// Consume GET /api/auditoria. Telemetría (event_ingested / position_reported / events_bulk_ingested)
// queda oculta por default — se activa con el toggle "Incluir telemetría".

import { useEffect, useMemo, useState } from "react";

interface AuditRow {
  id: string;
  ts: number;
  event: string;
  actor_id: string | null;
  actor_email: string | null;
  target_id: string | null;
  target_email: string | null;
  ip: string | null;
  fields: Record<string, unknown> | null;
}

interface AuditResponse {
  eventos: AuditRow[];
  total: number;
  limit: number;
  offset: number;
}

type Window = "24h" | "7d" | "30d" | "all";
const WINDOW_LABEL: Record<Window, string> = { "24h": "Hoy", "7d": "7 días", "30d": "30 días", all: "Todo" };
const WINDOW_DAYS: Record<Window, number | null> = { "24h": 1, "7d": 7, "30d": 30, all: null };

const EVENT_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "login_ok", label: "Login OK" },
  { value: "login_failed", label: "Login fallido" },
  { value: "impersonation_start", label: "Impersonate (inicio)" },
  { value: "impersonation_stop", label: "Impersonate (fin)" },
];

const EVENT_PILL: Record<string, string> = {
  login_ok: "pill-on",
  login_failed: "pill-off",
  impersonation_start: "pill-warn",
  impersonation_stop: "pill-warn",
  event_ingested: "pill-on",
  events_bulk_ingested: "pill-on",
  position_reported: "pill-on",
};

const PAGE_SIZE = 100;

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

function fmtFields(f: Record<string, unknown> | null): string {
  if (!f || Object.keys(f).length === 0) return "—";
  return Object.entries(f)
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export default function AuditoriaView() {
  const [window, setWindow] = useState<Window>("7d");
  const [eventFilter, setEventFilter] = useState<string>("");
  const [actorFilter, setActorFilter] = useState<string>("");
  const [includeTelemetry, setIncludeTelemetry] = useState(false);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset offset cuando cambia cualquier filtro
  useEffect(() => {
    setOffset(0);
  }, [window, eventFilter, actorFilter, includeTelemetry]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { from, to } = rangeFrom(window);
        const qs = new URLSearchParams({
          to: String(to),
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        if (from !== null) qs.set("from", String(from));
        if (eventFilter) qs.set("event", eventFilter);
        if (actorFilter.trim()) qs.set("actor", actorFilter.trim());
        if (includeTelemetry) qs.set("include_telemetry", "true");

        const res = await fetch(`/api/auditoria?${qs.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json: AuditResponse = await res.json();
        if (alive) setData(json);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [window, eventFilter, actorFilter, includeTelemetry, offset]);

  const total = data?.total ?? 0;
  const eventos = data?.eventos ?? [];
  const pageStart = offset + 1;
  const pageEnd = Math.min(offset + eventos.length, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  const btnStyle = useMemo(
    () => (active: boolean): React.CSSProperties => ({
      padding: ".25rem .7rem",
      fontSize: ".82rem",
      border: "1px solid " + (active ? "var(--accent)" : "var(--border)"),
      background: active ? "var(--accent)" : "transparent",
      color: active ? "#000" : "var(--text-muted)",
      borderRadius: "4px",
      cursor: "pointer",
      fontFamily: "inherit",
    }),
    []
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Auditoría</h2>
          <div className="page-subtitle">
            Histórico de eventos sensibles — logins, impersonaciones, ingestas críticas.
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="admin-card" style={{ padding: ".75rem 1.25rem", marginBottom: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
          <span style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Rango:</span>
          {(Object.keys(WINDOW_LABEL) as Window[]).map((w) => (
            <button key={w} onClick={() => setWindow(w)} style={btnStyle(window === w)}>
              {WINDOW_LABEL[w]}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
          <span style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Evento:</span>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            style={{
              padding: ".25rem .5rem",
              fontSize: ".82rem",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text)",
              borderRadius: "4px",
              fontFamily: "inherit",
            }}
          >
            {EVENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
          <span style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Actor:</span>
          <input
            type="text"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder="email o substring"
            style={{
              padding: ".25rem .5rem",
              fontSize: ".82rem",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text)",
              borderRadius: "4px",
              fontFamily: "inherit",
              width: "12rem",
            }}
          />
        </div>

        <label style={{ display: "flex", gap: ".4rem", alignItems: "center", fontSize: ".82rem", color: "var(--text-muted)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={includeTelemetry}
            onChange={(e) => setIncludeTelemetry(e.target.checked)}
          />
          Incluir telemetría (volumen alto)
        </label>

        <div style={{ marginLeft: "auto", fontSize: ".82rem", color: "var(--text-muted)" }}>
          {loading ? "Cargando…" : total === 0 ? "0 eventos" : `${pageStart}–${pageEnd} de ${total}`}
        </div>
      </div>

      {error && (
        <div className="admin-card" style={{ padding: ".75rem 1rem", marginBottom: "1rem", borderLeft: "3px solid var(--error)", color: "var(--error)" }}>
          ⚠ Error cargando auditoría: {error}
        </div>
      )}

      <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
        {eventos.length === 0 && !loading ? (
          <div className="empty-state">
            <strong>Sin eventos en el rango seleccionado</strong>
            Probá ampliar el rango, cambiar el evento o incluir telemetría.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Evento</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>IP</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((e) => (
                  <tr key={e.id}>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>{fmtDateTime(e.ts)}</td>
                    <td>
                      <span className={`pill ${EVENT_PILL[e.event] ?? "pill-warn"}`}>{e.event}</span>
                    </td>
                    <td>
                      {e.actor_email
                        ? <strong>{e.actor_email}</strong>
                        : e.actor_id
                          ? <span className="muted">{e.actor_id.slice(0, 8)}…</span>
                          : <span className="muted">—</span>}
                    </td>
                    <td>
                      {e.target_email
                        ? <strong>{e.target_email}</strong>
                        : e.target_id
                          ? <span className="muted">{e.target_id.slice(0, 8)}…</span>
                          : <span className="muted">—</span>}
                    </td>
                    <td className="muted" style={{ fontFamily: "monospace", fontSize: ".78rem" }}>{e.ip ?? "—"}</td>
                    <td className="muted" style={{ fontSize: ".78rem" }}>{fmtFields(e.fields)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {(hasPrev || hasNext) && (
          <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end", marginTop: ".75rem" }}>
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={!hasPrev}
              style={{ ...btnStyle(false), opacity: hasPrev ? 1 : 0.4, cursor: hasPrev ? "pointer" : "not-allowed" }}
            >
              ← Anterior
            </button>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={!hasNext}
              style={{ ...btnStyle(false), opacity: hasNext ? 1 : 0.4, cursor: hasNext ? "pointer" : "not-allowed" }}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
