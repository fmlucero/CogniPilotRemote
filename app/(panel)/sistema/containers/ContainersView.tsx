"use client";

// HU-45 — Tabla detallada de containers leída del daemon Docker via socket.
// Auto-refresh cada 15s. Filtros por estado y buscador por nombre/imagen.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface ContainerPort {
  host_ip: string | null;
  host_port: number | null;
  container_port: number;
  type: string;
}

interface ContainerNetwork {
  name: string;
  ip: string | null;
  aliases: string[];
}

interface ContainerRow {
  id: string;
  name: string;
  image: string | null;
  state: string | null;
  running: boolean;
  started_at: number | null;
  uptime_ms: number | null;
  restart_count: number;
  health: string | null;
  exit_code: number | null;
  error: string | null;
  ports: ContainerPort[];
  networks: ContainerNetwork[];
  command: string[] | string | null;
  labels: Record<string, string>;
}

interface ContainersResponse {
  containers: ContainerRow[];
  total: number;
  running: number;
  server_time: number;
}

type StateFilter = "all" | "running" | "stopped";

const POLL_MS = 15_000;

function fmtUptime(ms: number | null): string {
  if (ms === null || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function statePillClass(state: string | null, running: boolean, health: string | null): string {
  if (!running) return "pill-off";
  if (health === "unhealthy") return "pill-off";
  if (health === "starting") return "pill-warn";
  return "pill-on";
}

function shortImage(img: string | null): string {
  if (!img) return "—";
  // Aliviar "sha256:..." y mostrar repo:tag.
  if (img.startsWith("sha256:")) return img.slice(7, 19);
  return img;
}

export default function ContainersView() {
  const [data, setData] = useState<ContainersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/system/containers", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const d: ContainersResponse = await res.json();
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
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const containers = data?.containers ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return containers.filter((c) => {
      if (stateFilter === "running" && !c.running) return false;
      if (stateFilter === "stopped" && c.running) return false;
      if (q && !((c.name ?? "").toLowerCase().includes(q) || (c.image ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [containers, stateFilter, query]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Containers</h2>
          <div className="page-subtitle">
            Inventario completo del stack — leído del daemon Docker en la VM.
            {data && ` ${data.running} corriendo · ${data.total} total`}
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

      <div className="admin-card" style={{ padding: ".75rem 1.25rem", marginBottom: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
          <span style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Estado:</span>
          {(["all", "running", "stopped"] as StateFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStateFilter(s)}
              style={{
                padding: ".25rem .7rem",
                fontSize: ".82rem",
                border: "1px solid " + (stateFilter === s ? "var(--accent)" : "var(--border)"),
                background: stateFilter === s ? "var(--accent)" : "transparent",
                color: stateFilter === s ? "#000" : "var(--text-muted)",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              {s === "all" ? "Todos" : s === "running" ? "Corriendo" : "Detenidos"}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Buscar por nombre o imagen…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, minWidth: "240px", padding: ".4rem .7rem", fontSize: ".88rem", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)" }}
        />
        <span style={{ fontSize: ".78rem", color: "var(--text-faint)" }}>
          {loading && !data ? "Cargando…" : `Refresca cada ${POLL_MS / 1000}s`}
        </span>
      </div>

      <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <strong>{loading ? "Cargando…" : "Sin containers en el filtro"}</strong>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Imagen</th>
                  <th>Estado</th>
                  <th>Health</th>
                  <th>Uptime</th>
                  <th>Restarts</th>
                  <th>Puertos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const isExpanded = expanded === c.id;
                  return (
                    <>
                      <tr key={c.id}>
                        <td>
                          <strong>{c.name}</strong>
                          <div style={{ fontSize: ".7rem", color: "var(--text-faint)", fontFamily: "var(--font-mono, monospace)" }}>{c.id}</div>
                        </td>
                        <td className="muted" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: ".8rem" }}>
                          {shortImage(c.image)}
                        </td>
                        <td>
                          <span className={`pill ${statePillClass(c.state, c.running, c.health)}`}>
                            {c.state ?? "—"}
                            {c.exit_code !== null && !c.running ? ` (${c.exit_code})` : ""}
                          </span>
                        </td>
                        <td className="muted">{c.health ?? "—"}</td>
                        <td className="muted">{fmtUptime(c.uptime_ms)}</td>
                        <td>
                          {c.restart_count > 0 ? (
                            <span className="pill pill-warn">{c.restart_count}</span>
                          ) : (
                            <span className="muted">0</span>
                          )}
                        </td>
                        <td className="muted" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: ".78rem" }}>
                          {c.ports.length === 0 ? "—" : c.ports.map((p, i) => (
                            <div key={i}>
                              {p.host_port ? `${p.host_port}→${p.container_port}` : p.container_port}
                              <span style={{ color: "var(--text-faint)" }}>/{p.type}</span>
                            </div>
                          ))}
                        </td>
                        <td>
                          <button
                            onClick={() => setExpanded(isExpanded ? null : c.id)}
                            style={{ background: "transparent", color: "var(--accent)", border: "none", cursor: "pointer", fontSize: ".85rem" }}
                          >
                            {isExpanded ? "Ocultar" : "Detalle"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} style={{ background: "var(--bg-elev)", padding: ".75rem 1rem" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", fontSize: ".82rem" }}>
                              <div>
                                <strong>Networks</strong>
                                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                                  {c.networks.map((n) => (
                                    <li key={n.name} className="muted" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: ".75rem" }}>
                                      {n.name} {n.ip ? `· ${n.ip}` : ""}
                                      {n.aliases.length > 0 && <div style={{ fontSize: ".7rem", color: "var(--text-faint)" }}>aliases: {n.aliases.join(", ")}</div>}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <strong>Imagen completa</strong>
                                <div className="muted" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: ".75rem", wordBreak: "break-all" }}>{c.image ?? "—"}</div>
                              </div>
                              <div>
                                <strong>Comando</strong>
                                <div className="muted" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: ".75rem", wordBreak: "break-all" }}>
                                  {Array.isArray(c.command) ? c.command.join(" ") : c.command ?? "—"}
                                </div>
                              </div>
                              {c.error && (
                                <div>
                                  <strong style={{ color: "var(--error)" }}>Error</strong>
                                  <div style={{ fontSize: ".75rem", color: "var(--error)" }}>{c.error}</div>
                                </div>
                              )}
                              {c.started_at && (
                                <div>
                                  <strong>Iniciado</strong>
                                  <div className="muted" style={{ fontSize: ".75rem" }}>
                                    {new Date(c.started_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" })}
                                  </div>
                                </div>
                              )}
                              {Object.keys(c.labels).length > 0 && (
                                <div>
                                  <strong>Compose labels</strong>
                                  <div className="muted" style={{ fontSize: ".7rem", fontFamily: "var(--font-mono, monospace)" }}>
                                    {Object.entries(c.labels).map(([k, v]) => (
                                      <div key={k}>{k.replace("com.docker.compose.", "")}: {v}</div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
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
