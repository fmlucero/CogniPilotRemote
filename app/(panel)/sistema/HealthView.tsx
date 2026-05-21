"use client";

// HU-38 — Cliente para /health: snapshot de containers + lag de eventos.
// Auto-refresh cada 15s. Cards de estado por servicio + KPI cards.

import { useEffect, useState } from "react";

interface HealthService {
  name: string;
  status: "up" | "down" | "unknown";
  detail: string | null;
}

interface HealthResponse {
  services: HealthService[];
  uptime_seconds: number;
  eventos_lag_seconds: number | null;
  devices_active_5m: number;
  checked_at: number;
}

const POLL_MS = 15_000;

const STATUS_COLOR: Record<HealthService["status"], string> = {
  up: "var(--success)",
  down: "var(--error)",
  unknown: "var(--warning)",
};
const STATUS_ICON: Record<HealthService["status"], string> = {
  up: "✅",
  down: "❌",
  unknown: "⚠️",
};

const SERVICE_LABEL: Record<string, string> = {
  "back-api": "FastAPI (back-api)",
  postgres: "PostgreSQL",
  redis: "Redis",
  prometheus: "Prometheus",
};

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtLag(sec: number | null): string {
  if (sec === null) return "—";
  if (sec < 60) return `${sec.toFixed(0)}s`;
  if (sec < 3600) return `${(sec / 60).toFixed(1)}m`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)}h`;
  return `${(sec / 86400).toFixed(1)}d`;
}

function lagColor(sec: number | null): string {
  if (sec === null) return "var(--text-faint)";
  if (sec < 300) return "var(--success)";       // <5min
  if (sec < 3600) return "var(--warning)";      // <1h
  return "var(--error)";                        // >1h
}

export default function HealthView() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/metrics/health", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const d: HealthResponse = await res.json();
        if (alive) {
          setData(d);
          setError(null);
          setLastCheck(Date.now());
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Salud del sistema</h2>
          <div className="page-subtitle">
            Estado de containers, latencia de ingesta y dispositivos activos · refresca cada 15s
            {lastCheck && <span style={{ color: "var(--text-faint)" }}> · último chequeo {new Date(lastCheck).toLocaleTimeString("es-AR", { hour12: false })}</span>}
          </div>
        </div>
      </div>

      {error && (
        <div className="admin-card" style={{ padding: ".75rem 1rem", marginBottom: "1rem", borderLeft: "3px solid var(--error)", color: "var(--error)" }}>
          ⚠️ Error consultando salud: {error}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: ".72rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".25rem" }}>Uptime back-api</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 600, lineHeight: 1.1 }}>
            {data ? fmtUptime(data.uptime_seconds) : "…"}
          </div>
        </div>
        <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: ".72rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".25rem" }}>Lag de eventos</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 600, lineHeight: 1.1, color: data ? lagColor(data.eventos_lag_seconds) : "var(--text)" }}>
            {data ? fmtLag(data.eventos_lag_seconds) : "…"}
          </div>
          <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginTop: ".25rem" }}>desde el último evento ingestado</div>
        </div>
        <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: ".72rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".25rem" }}>Devices online (5m)</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 600, lineHeight: 1.1, color: data && data.devices_active_5m > 0 ? "var(--success)" : "var(--text-faint)" }}>
            {data ? data.devices_active_5m : "…"}
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
        <div className="card-header" style={{ marginBottom: ".75rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>📦 Containers / servicios</h2>
        </div>
        {!data ? (
          <div className="empty-state">Cargando estado…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: ".75rem" }}>
            {data.services.map((s) => (
              <div
                key={s.name}
                style={{
                  padding: ".75rem 1rem",
                  background: "var(--bg-elev)",
                  border: "1px solid var(--border)",
                  borderLeft: `3px solid ${STATUS_COLOR[s.status]}`,
                  borderRadius: "6px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: ".5rem",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{STATUS_ICON[s.status]} {SERVICE_LABEL[s.name] ?? s.name}</div>
                  {s.detail && <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginTop: "2px" }}>{s.detail}</div>}
                </div>
                <span style={{
                  padding: ".15rem .55rem",
                  fontSize: ".7rem",
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  background: STATUS_COLOR[s.status],
                  color: "#000",
                  borderRadius: "10px",
                  fontWeight: 600,
                }}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: "1rem", fontSize: ".78rem", color: "var(--text-faint)" }}>
        ⓘ Esta vista cubre los servicios que el back-api puede chequear directamente (postgres, redis, prometheus).
        Containers de borde (nginx, app Next.js) no aparecen porque están delante del back y si vos estás viendo esta página significa que ambos están up.
      </div>
    </>
  );
}
