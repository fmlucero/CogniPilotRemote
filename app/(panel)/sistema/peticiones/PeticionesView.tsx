"use client";

// HU-47 — Tabla live de las últimas 100 peticiones HTTP que recibió el back.
// Lee /api/system/requests con auto-refresh 5s. Filtros por familia de status
// (2xx/3xx/4xx/5xx) + búsqueda por path.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Item {
  ts: number;
  method: string;
  path: string;
  query: string;
  status: number;
  latency_ms: number;
  client_ip: string | null;
  user_agent: string | null;
}

interface Response {
  items: Item[];
  count: number;
  max_items: number;
  server_time: number;
}

type StatusFilter = "all" | "2xx" | "3xx" | "4xx" | "5xx";

const POLL_MS = 5_000;
const TZ = "America/Argentina/Buenos_Aires";

function statusFamily(status: number): StatusFilter {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  if (status >= 200) return "2xx";
  return "all";
}

function statusPill(status: number): string {
  if (status >= 500) return "pill-off";
  if (status >= 400) return "pill-warn";
  if (status >= 300) return "pill";
  return "pill-on";
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("es-AR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: TZ,
  });
}

function fmtLatency(ms: number): { text: string; color: string } {
  if (ms < 50) return { text: `${ms.toFixed(1)} ms`, color: "var(--text-muted)" };
  if (ms < 200) return { text: `${ms.toFixed(1)} ms`, color: "#fbbf24" };
  if (ms < 1000) return { text: `${ms.toFixed(1)} ms`, color: "#fb923c" };
  return { text: `${(ms / 1000).toFixed(2)} s`, color: "#f87171" };
}

function methodColor(method: string): string {
  switch (method) {
    case "GET": return "#7dd3fc";
    case "POST": return "#5eead4";
    case "PATCH": return "#fbbf24";
    case "PUT": return "#fbbf24";
    case "DELETE": return "#f87171";
    default: return "var(--text-muted)";
  }
}

export default function PeticionesView() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [paused, setPaused] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/system/requests", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const d: Response = await res.json();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (paused) return;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [paused]);

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (statusFilter !== "all" && statusFamily(i.status) !== statusFilter) return false;
      if (q && !i.path.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, statusFilter, query]);

  // Resumen por status family
  const stats = useMemo(() => {
    const s = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 } as Record<string, number>;
    for (const i of items) {
      const f = statusFamily(i.status);
      if (f !== "all") s[f] += 1;
    }
    return s;
  }, [items]);

  // Latencias agregadas (p50, p95, max) de las items visibles
  const latencyStats = useMemo(() => {
    if (items.length === 0) return null;
    const sorted = [...items].map((i) => i.latency_ms).sort((a, b) => a - b);
    const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
    return { p50: pick(0.5), p95: pick(0.95), max: sorted[sorted.length - 1] };
  }, [items]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Peticiones HTTP</h2>
          <div className="page-subtitle">
            Live tail de las últimas {data?.max_items ?? 100} peticiones que recibió el back-api
            {data && ` · ${data.count} en buffer`}
            {paused ? " · PAUSADO" : ` · refresca cada ${POLL_MS / 1000}s`}
          </div>
        </div>
        <Link href="/sistema" style={{ color: "var(--accent)", fontSize: ".88rem", alignSelf: "flex-start" }}>
          ← Volver a Infraestructura
        </Link>
      </div>

      {error && (
        <div className="admin-card" style={{ padding: ".75rem 1rem", marginBottom: "1rem", borderLeft: "3px solid var(--error)", color: "var(--error)" }}>
          ⚠ {error}
        </div>
      )}

      {/* Stats + controles */}
      <div className="admin-card" style={{ padding: ".75rem 1.25rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
            <span style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Status:</span>
            {(["all", "2xx", "3xx", "4xx", "5xx"] as StatusFilter[]).map((s) => {
              const count = s === "all" ? items.length : stats[s] || 0;
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: ".25rem .7rem",
                    fontSize: ".82rem",
                    border: "1px solid " + (active ? "var(--accent)" : "var(--border)"),
                    background: active ? "var(--accent)" : "transparent",
                    color: active ? "#000" : "var(--text-muted)",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  {s === "all" ? "Todos" : s} <span style={{ opacity: 0.7, fontSize: ".75rem" }}>({count})</span>
                </button>
              );
            })}
          </div>
          <input
            type="search"
            placeholder="Filtrar por path…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: "200px", padding: ".4rem .7rem", fontSize: ".88rem", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)" }}
          />
          <button
            onClick={() => setPaused((p) => !p)}
            style={{
              padding: ".4rem .9rem",
              fontSize: ".82rem",
              background: paused ? "#fbbf24" : "var(--bg-elev)",
              color: paused ? "#000" : "var(--text-muted)",
              border: "1px solid " + (paused ? "#fbbf24" : "var(--border)"),
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {paused ? "▶ Reanudar" : "⏸ Pausar"}
          </button>
        </div>
        {latencyStats && (
          <div style={{ marginTop: ".5rem", fontSize: ".78rem", color: "var(--text-faint)" }}>
            Latencia (últimas {items.length} requests) — p50: <strong>{latencyStats.p50.toFixed(1)} ms</strong> · p95: <strong>{latencyStats.p95.toFixed(1)} ms</strong> · max: <strong>{latencyStats.max.toFixed(1)} ms</strong>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <strong>{loading ? "Cargando…" : items.length === 0 ? "Aún no hay peticiones en el buffer" : "Sin matches en el filtro"}</strong>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "90px" }}>Hora</th>
                  <th style={{ width: "70px" }}>Método</th>
                  <th>Path</th>
                  <th style={{ width: "80px" }}>Status</th>
                  <th style={{ width: "100px" }}>Latencia</th>
                  <th style={{ width: "130px" }}>Cliente</th>
                  <th>User-Agent</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i, idx) => {
                  const lat = fmtLatency(i.latency_ms);
                  return (
                    <tr key={`${i.ts}-${idx}`}>
                      <td className="muted" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: ".78rem" }}>
                        {fmtTime(i.ts)}
                      </td>
                      <td>
                        <span style={{ color: methodColor(i.method), fontWeight: 600, fontFamily: "var(--font-mono, monospace)", fontSize: ".82rem" }}>
                          {i.method}
                        </span>
                      </td>
                      <td style={{ fontFamily: "var(--font-mono, monospace)", fontSize: ".82rem", wordBreak: "break-all" }}>
                        {i.path}
                        {i.query && (
                          <span style={{ color: "var(--text-faint)" }}>?{i.query}</span>
                        )}
                      </td>
                      <td>
                        <span className={`pill ${statusPill(i.status)}`} style={{ fontFamily: "var(--font-mono, monospace)" }}>
                          {i.status}
                        </span>
                      </td>
                      <td style={{ color: lat.color, fontFamily: "var(--font-mono, monospace)", fontSize: ".82rem" }}>
                        {lat.text}
                      </td>
                      <td className="muted" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: ".78rem" }}>
                        {i.client_ip ?? "—"}
                      </td>
                      <td className="muted" style={{ fontSize: ".75rem", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={i.user_agent ?? ""}>
                        {i.user_agent || "—"}
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
