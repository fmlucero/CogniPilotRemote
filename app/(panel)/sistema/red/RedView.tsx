"use client";

// HU-46 — Diagrama de red y topología leído de /api/system/topology.
// SVG manual (sin libs): cajas posicionadas por columna, edges con bezier suaves.
// Auto-refresh cada 15s. Debajo del diagrama, tabla con detalle por nodo.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Port {
  port?: number;
  host_ip?: string | null;
  host_port?: number | null;
  container_port?: number;
  type: string;
  label?: string;
}

interface Network {
  name: string;
  ip: string | null;
  aliases: string[];
}

interface Live {
  running: boolean;
  state: string | null;
  health: string | null;
  restart_count: number;
  started_at: number | null;
  uptime_ms: number | null;
  image: string | null;
  networks: Network[];
  ports: Port[];
}

interface Node {
  id: string;
  label: string;
  type: "external" | "proxy" | "app" | "data" | "observ" | "extra";
  column: number;
  container_name: string | null;
  status: "ok" | "missing" | "stopped" | "unhealthy" | "starting" | "external" | "unknown";
  note: string | null;
  default_ports: Port[];
  live: Live;
}

interface Edge {
  from: string;
  to: string;
  label: string;
  protocol: string;
}

interface Column {
  id: number;
  label: string;
}

interface Topology {
  nodes: Node[];
  edges: Edge[];
  columns: Column[];
  server_time: number;
}

const POLL_MS = 15_000;

// Layout
const BOX_W = 170;
const BOX_H = 64;
const COL_GAP = 70; // gap horizontal entre cajas (no entre centros)
const ROW_GAP = 26; // gap vertical entre cajas
const PAD_X = 24;
const PAD_Y = 28;

const TYPE_COLOR: Record<Node["type"], { fill: string; stroke: string }> = {
  external: { fill: "#2a2a3a", stroke: "#a78bfa" },
  proxy: { fill: "#1f3a3a", stroke: "#5eead4" },
  app: { fill: "#1f2a3a", stroke: "#7dd3fc" },
  data: { fill: "#3a2a1f", stroke: "#fbbf24" },
  observ: { fill: "#2a1f3a", stroke: "#d8b4fe" },
  extra: { fill: "#2a2a2a", stroke: "#9ca3af" },
};

const STATUS_PILL: Record<Node["status"], string> = {
  ok: "pill-on",
  external: "pill",
  missing: "pill-off",
  stopped: "pill-off",
  unhealthy: "pill-off",
  starting: "pill-warn",
  unknown: "pill",
};

function fmtUptime(ms: number | null): string {
  if (ms === null || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function shortImage(img: string | null): string {
  if (!img) return "—";
  if (img.startsWith("sha256:")) return img.slice(7, 19);
  return img;
}

// Calcula posiciones {x,y} (centros) por nodo agrupando por column.
function computePositions(nodes: Node[]): { positions: Map<string, { x: number; y: number }>; width: number; height: number } {
  const byCol = new Map<number, Node[]>();
  for (const n of nodes) {
    if (!byCol.has(n.column)) byCol.set(n.column, []);
    byCol.get(n.column)!.push(n);
  }
  const cols = [...byCol.keys()].sort((a, b) => a - b);
  const maxRows = Math.max(...cols.map((c) => byCol.get(c)!.length), 1);

  const positions = new Map<string, { x: number; y: number }>();
  const colWidth = BOX_W + COL_GAP;
  const totalHeight = PAD_Y * 2 + maxRows * BOX_H + (maxRows - 1) * ROW_GAP;

  cols.forEach((colId, colIdx) => {
    const colNodes = byCol.get(colId)!;
    const colHeight = colNodes.length * BOX_H + (colNodes.length - 1) * ROW_GAP;
    const startY = (totalHeight - colHeight) / 2 + BOX_H / 2;
    colNodes.forEach((n, rowIdx) => {
      const x = PAD_X + colIdx * colWidth + BOX_W / 2;
      const y = startY + rowIdx * (BOX_H + ROW_GAP);
      positions.set(n.id, { x, y });
    });
  });

  const width = PAD_X * 2 + cols.length * BOX_W + (cols.length - 1) * COL_GAP;
  return { positions, width, height: totalHeight };
}

// Path bezier suave: sale del borde derecho del 'from' y entra al borde izquierdo del 'to'.
// Si los dos nodos están en la misma columna o el 'to' está antes (cíclico),
// hacemos un loop por arriba.
function edgePath(from: { x: number; y: number }, to: { x: number; y: number }, offset: number = 0): string {
  const fromX = from.x + BOX_W / 2;
  const toX = to.x - BOX_W / 2;
  const dx = toX - fromX;
  if (dx <= 0) {
    // Loop por arriba (no se usa en el grafo actual pero por completitud)
    const midY = Math.min(from.y, to.y) - 50;
    return `M ${fromX} ${from.y} C ${fromX + 60} ${midY}, ${toX - 60} ${midY}, ${toX} ${to.y}`;
  }
  // Offset vertical permite separar edges paralelas (mismo from→to).
  const controlOffset = dx * 0.45;
  const fy = from.y + offset;
  const ty = to.y + offset;
  return `M ${fromX} ${fy} C ${fromX + controlOffset} ${fy}, ${toX - controlOffset} ${ty}, ${toX} ${ty}`;
}

export default function RedView() {
  const [data, setData] = useState<Topology | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/system/topology", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const d: Topology = await res.json();
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

  const { positions, width, height } = useMemo(
    () => (data ? computePositions(data.nodes) : { positions: new Map(), width: 0, height: 0 }),
    [data]
  );

  // Agrupar edges por par from→to para offsetear las paralelas.
  const edgesWithOffset = useMemo(() => {
    if (!data) return [];
    const groups = new Map<string, Edge[]>();
    for (const e of data.edges) {
      const k = `${e.from}→${e.to}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(e);
    }
    const out: { edge: Edge; offset: number }[] = [];
    for (const [, group] of groups) {
      group.forEach((edge, i) => {
        const offset = group.length > 1 ? (i - (group.length - 1) / 2) * 14 : 0;
        out.push({ edge, offset });
      });
    }
    return out;
  }, [data]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Red y topología</h2>
          <div className="page-subtitle">
            Flujo de peticiones del stack — Cloudflare → nginx → app/back-api → postgres/redis.
            {data && ` ${data.nodes.length} nodos · ${data.edges.length} conexiones`}
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

      {!data ? (
        <div className="admin-card" style={{ padding: "1.5rem 1.25rem" }}>
          <div className="empty-state"><strong>{loading ? "Cargando topología…" : "Sin datos"}</strong></div>
        </div>
      ) : (
        <>
          {/* Diagrama */}
          <div className="admin-card" style={{ padding: "1rem 1.25rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".5rem", flexWrap: "wrap", gap: ".5rem" }}>
              <strong style={{ fontSize: ".95rem" }}>Diagrama</strong>
              <span style={{ fontSize: ".78rem", color: "var(--text-faint)" }}>Refresca cada {POLL_MS / 1000}s</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <svg width={width} height={height + 32} style={{ display: "block", minWidth: width }}>
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
                    <path d="M 0 0 L 10 4 L 0 8 z" fill="var(--text-muted, #9ca3af)" />
                  </marker>
                  <marker id="arrowhead-sse" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="strokeWidth">
                    <path d="M 0 0 L 10 4 L 0 8 z" fill="#7dd3fc" />
                  </marker>
                </defs>

                {/* Headers de columna */}
                {data.columns.filter((c) => data.nodes.some((n) => n.column === c.id)).map((c, idx) => {
                  const x = PAD_X + idx * (BOX_W + COL_GAP) + BOX_W / 2;
                  return (
                    <text key={c.id} x={x} y={height + 22} textAnchor="middle" fontSize="11" fill="var(--text-faint)" style={{ textTransform: "uppercase", letterSpacing: ".05em" }}>
                      {c.label}
                    </text>
                  );
                })}

                {/* Edges (debajo de los nodos) */}
                {edgesWithOffset.map(({ edge, offset }, i) => {
                  const from = positions.get(edge.from);
                  const to = positions.get(edge.to);
                  if (!from || !to) return null;
                  const isSse = edge.protocol === "sse";
                  const stroke = isSse ? "#7dd3fc" : "var(--text-muted, #9ca3af)";
                  const dash = isSse ? "4 4" : undefined;
                  // Punto medio para la etiqueta
                  const midX = (from.x + BOX_W / 2 + to.x - BOX_W / 2) / 2;
                  const midY = (from.y + to.y) / 2 + offset;
                  return (
                    <g key={i}>
                      <path
                        d={edgePath(from, to, offset)}
                        stroke={stroke}
                        strokeWidth="1.5"
                        fill="none"
                        strokeDasharray={dash}
                        markerEnd={isSse ? "url(#arrowhead-sse)" : "url(#arrowhead)"}
                        opacity={0.7}
                      />
                      <text
                        x={midX}
                        y={midY - 4}
                        textAnchor="middle"
                        fontSize="9.5"
                        fill="var(--text-muted, #9ca3af)"
                        style={{ pointerEvents: "none" }}
                      >
                        {edge.label}
                      </text>
                    </g>
                  );
                })}

                {/* Nodes */}
                {data.nodes.map((n) => {
                  const pos = positions.get(n.id);
                  if (!pos) return null;
                  const colors = TYPE_COLOR[n.type];
                  const isStale = n.status === "missing" || n.status === "stopped";
                  const isWarn = n.status === "unhealthy";
                  const borderColor = isStale ? "#6b7280" : isWarn ? "#f87171" : colors.stroke;
                  return (
                    <g
                      key={n.id}
                      onClick={() => setSelectedNode(selectedNode === n.id ? null : n.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <rect
                        x={pos.x - BOX_W / 2}
                        y={pos.y - BOX_H / 2}
                        width={BOX_W}
                        height={BOX_H}
                        rx={6}
                        ry={6}
                        fill={colors.fill}
                        stroke={borderColor}
                        strokeWidth={selectedNode === n.id ? 2.5 : 1.5}
                        opacity={isStale ? 0.55 : 1}
                      />
                      <text
                        x={pos.x}
                        y={pos.y - 8}
                        textAnchor="middle"
                        fontSize="13"
                        fontWeight="600"
                        fill="var(--text, #e5e7eb)"
                      >
                        {n.label}
                      </text>
                      <text
                        x={pos.x}
                        y={pos.y + 10}
                        textAnchor="middle"
                        fontSize="10.5"
                        fill="var(--text-muted, #9ca3af)"
                      >
                        {n.container_name ?? "host (systemd)"}
                      </text>
                      {n.status !== "ok" && n.status !== "external" && (
                        <text
                          x={pos.x}
                          y={pos.y + 24}
                          textAnchor="middle"
                          fontSize="9"
                          fill={isWarn ? "#f87171" : "#9ca3af"}
                          fontWeight="600"
                          style={{ textTransform: "uppercase", letterSpacing: ".05em" }}
                        >
                          {n.status}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
            <div style={{ marginTop: ".75rem", fontSize: ".75rem", color: "var(--text-faint)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <span>Click en un nodo para resaltar y ver detalle en la tabla.</span>
              <span><svg width="22" height="8" style={{ verticalAlign: "middle" }}><line x1="0" y1="4" x2="22" y2="4" stroke="#7dd3fc" strokeWidth="1.5" strokeDasharray="4 4" /></svg> SSE</span>
            </div>
          </div>

          {/* Tabla */}
          <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nodo</th>
                    <th>Container</th>
                    <th>Estado</th>
                    <th>Health</th>
                    <th>Uptime</th>
                    <th>IP / Network</th>
                    <th>Imagen</th>
                    <th>Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {data.nodes.map((n) => {
                    const nets = n.live.networks;
                    const isSelected = selectedNode === n.id;
                    return (
                      <tr
                        key={n.id}
                        onClick={() => setSelectedNode(isSelected ? null : n.id)}
                        style={{ cursor: "pointer", background: isSelected ? "var(--bg-elev)" : undefined }}
                      >
                        <td>
                          <strong>{n.label}</strong>
                          <div style={{ fontSize: ".7rem", color: "var(--text-faint)" }}>
                            {n.type}
                          </div>
                        </td>
                        <td className="muted" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: ".78rem" }}>
                          {n.container_name ?? <span style={{ color: "var(--text-faint)" }}>— host —</span>}
                        </td>
                        <td>
                          <span className={`pill ${STATUS_PILL[n.status]}`}>{n.status}</span>
                        </td>
                        <td className="muted">{n.live.health ?? "—"}</td>
                        <td className="muted">{fmtUptime(n.live.uptime_ms)}</td>
                        <td className="muted" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: ".75rem" }}>
                          {nets.length === 0 ? "—" : nets.map((net) => (
                            <div key={net.name}>
                              {net.ip ?? "—"} <span style={{ color: "var(--text-faint)" }}>· {net.name}</span>
                            </div>
                          ))}
                        </td>
                        <td className="muted" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: ".75rem", maxWidth: "240px", wordBreak: "break-all" }}>
                          {shortImage(n.live.image)}
                        </td>
                        <td style={{ fontSize: ".78rem", color: "var(--text-muted)", maxWidth: "300px" }}>
                          {n.note ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
