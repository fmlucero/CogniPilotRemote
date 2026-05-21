"use client";

// HU-21 — Cliente para /metricas: polling de overview + 3 sparkline charts SVG.
// Sin libs externas (recharts/tremor) — los charts son SVG nativos. Las dimensiones
// se adaptan al contenedor vía viewBox.

import { useEffect, useState } from "react";

export interface MetricsOverview {
  server: { uptime_seconds: number; version: string; env: string };
  http: {
    requests_total: number;
    requests_per_second_5m: number | null;
    error_rate_5m: number | null;
    latency_p50_ms: number | null;
    latency_p95_ms: number | null;
    latency_p99_ms: number | null;
  };
  events: { ingested_total: number; ingested_per_minute_1h: number | null };
  devices: { registered_total: number; active_5m: number; active_24h: number };
  queue: { depth: number; jobs_completed_total: number; jobs_failed_total: number };
  prometheus_available: boolean;
}

interface TimeseriesResp {
  metric: string;
  window: string;
  step: string;
  points: { ts: number; value: number }[];
  prometheus_available: boolean;
}

type Window = "15m" | "1h" | "6h" | "24h" | "7d";
const WINDOWS: Window[] = ["15m", "1h", "6h", "24h", "7d"];

const OVERVIEW_POLL_MS = 10_000;
const TIMESERIES_POLL_MS = 30_000;

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtNumber(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  return n.toFixed(digits);
}

function fmtMs(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`;
  return `${n.toFixed(0)}ms`;
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

// ─── Card ───────────────────────────────────────────────────────────────────

function Card({ title, value, sub, accent }: { title: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
      <div style={{ fontSize: ".72rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".25rem" }}>
        {title}
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 600, color: accent || "var(--text)", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginTop: ".25rem" }}>{sub}</div>}
    </div>
  );
}

// ─── Sparkline SVG ──────────────────────────────────────────────────────────

function Sparkline({ points, height = 60, color = "#ffe14d" }: { points: number[]; height?: number; color?: string }) {
  if (points.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: ".8rem" }}>
        sin datos en la ventana
      </div>
    );
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 100; // viewBox arbitrary, escala con CSS
  const path = points.map((v, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  // Área debajo del path
  const lastX = width;
  const firstX = 0;
  const area = `${path} L${lastX},${height} L${firstX},${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad-${color.replace("#", "")})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function ChartCard({
  title, points, unit, color, loading,
}: {
  title: string;
  points: { ts: number; value: number }[];
  unit?: string;
  color?: string;
  loading?: boolean;
}) {
  const values = points.map((p) => p.value);
  const last = values.length ? values[values.length - 1] : null;
  return (
    <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: ".5rem" }}>
        <div style={{ fontSize: ".82rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>{title}</div>
        <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
          {loading && !points.length ? "…" : `${fmtNumber(last)}${unit ? " " + unit : ""}`}
        </div>
      </div>
      <Sparkline points={values} color={color} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".68rem", color: "var(--text-faint)", marginTop: ".25rem" }}>
        <span>{points.length ? new Date(points[0].ts * 1000).toLocaleTimeString("es-AR", { hour12: false }) : ""}</span>
        <span>{points.length ? new Date(points[points.length - 1].ts * 1000).toLocaleTimeString("es-AR", { hour12: false }) : ""}</span>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function MetricasClient({ initial }: { initial: MetricsOverview | null }) {
  const [overview, setOverview] = useState<MetricsOverview | null>(initial);
  const [overviewErr, setOverviewErr] = useState(false);
  const [window, setWindow] = useState<Window>("1h");
  const [reqRate, setReqRate] = useState<TimeseriesResp | null>(null);
  const [latP95, setLatP95] = useState<TimeseriesResp | null>(null);
  const [evRate, setEvRate] = useState<TimeseriesResp | null>(null);
  const [tsLoading, setTsLoading] = useState(true);

  // Overview polling
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/metrics/overview", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data: MetricsOverview = await res.json();
        if (alive) {
          setOverview(data);
          setOverviewErr(false);
        }
      } catch {
        if (alive) setOverviewErr(true);
      }
    }
    if (!initial) poll();
    const t = window === "15m" ? OVERVIEW_POLL_MS : OVERVIEW_POLL_MS; // overview no depende del window
    const id = setInterval(poll, t);
    return () => { alive = false; clearInterval(id); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Timeseries polling — depende del window seleccionado
  useEffect(() => {
    let alive = true;
    async function loadOne(metric: string): Promise<TimeseriesResp | null> {
      const step = window === "15m" ? 30 : window === "1h" ? 60 : window === "6h" ? 300 : window === "24h" ? 900 : 3600;
      const res = await fetch(`/api/metrics/timeseries?metric=${metric}&window=${window}&step=${step}`, { cache: "no-store" });
      if (!res.ok) return null;
      return res.json();
    }
    async function loadAll() {
      setTsLoading(true);
      const [r, l, e] = await Promise.all([
        loadOne("requests_rate"),
        loadOne("latency_p95_ms"),
        loadOne("events_rate"),
      ]);
      if (!alive) return;
      setReqRate(r);
      setLatP95(l);
      setEvRate(e);
      setTsLoading(false);
    }
    loadAll();
    const id = setInterval(loadAll, TIMESERIES_POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [window]);

  return (
    <>
      {/* Banner si el back está inalcanzable */}
      {overviewErr && (
        <div className="admin-card" style={{ padding: ".75rem 1rem", marginBottom: "1rem", borderLeft: "3px solid var(--error)", color: "var(--error)" }}>
          ⚠️ No se pudo refrescar el overview. Reintentando…
        </div>
      )}

      {/* Cards arriba */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <Card
          title="Uptime"
          value={overview ? fmtUptime(overview.server.uptime_seconds) : "—"}
          sub={overview ? `v${overview.server.version} · ${overview.server.env}` : ""}
        />
        <Card
          title="Requests/seg (5m)"
          value={overview ? fmtNumber(overview.http.requests_per_second_5m) : "—"}
          sub={overview ? `total: ${overview.http.requests_total.toLocaleString("es-AR")}` : ""}
        />
        <Card
          title="Error rate (5m)"
          value={overview ? fmtPct(overview.http.error_rate_5m) : "—"}
          accent={overview && (overview.http.error_rate_5m || 0) > 0.01 ? "var(--error)" : undefined}
        />
        <Card
          title="Latency p95"
          value={overview ? fmtMs(overview.http.latency_p95_ms) : "—"}
          sub={overview ? `p50 ${fmtMs(overview.http.latency_p50_ms)} · p99 ${fmtMs(overview.http.latency_p99_ms)}` : ""}
        />
        <Card
          title="Eventos totales"
          value={overview ? overview.events.ingested_total.toLocaleString("es-AR") : "—"}
        />
        <Card
          title="Dispositivos activos"
          value={overview ? overview.devices.active_5m.toString() : "—"}
          sub={overview ? `24h: ${overview.devices.active_24h} · total: ${overview.devices.registered_total}` : ""}
          accent={overview && overview.devices.active_5m > 0 ? "var(--success)" : undefined}
        />
        <Card
          title="Queue depth"
          value={overview ? overview.queue.depth.toString() : "—"}
          sub={overview ? `ok: ${overview.queue.jobs_completed_total} · fail: ${overview.queue.jobs_failed_total}` : ""}
        />
        <Card
          title="Prometheus"
          value={overview?.prometheus_available ? "✅ OK" : "❌ caído"}
          accent={overview?.prometheus_available ? "var(--success)" : "var(--error)"}
        />
      </div>

      {/* Selector de window */}
      <div style={{ display: "flex", gap: ".5rem", alignItems: "center", marginBottom: ".75rem" }}>
        <span style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Rango:</span>
        {WINDOWS.map((w) => (
          <button
            key={w}
            onClick={() => setWindow(w)}
            style={{
              padding: ".25rem .65rem",
              fontSize: ".8rem",
              border: "1px solid " + (window === w ? "var(--accent)" : "var(--border)"),
              background: window === w ? "var(--accent)" : "transparent",
              color: window === w ? "#000" : "var(--text-muted)",
              borderRadius: "4px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {w}
          </button>
        ))}
        {!overview?.prometheus_available && (
          <span style={{ fontSize: ".75rem", color: "var(--warning)", marginLeft: "auto" }}>
            ⚠️ Prometheus no disponible — los gráficos no tienen datos
          </span>
        )}
      </div>

      {/* Charts en grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        <ChartCard title="Requests / seg" points={reqRate?.points || []} unit="r/s" color="#ffe14d" loading={tsLoading} />
        <ChartCard title="Latency p95" points={latP95?.points || []} unit="ms" color="#f5a524" loading={tsLoading} />
        <ChartCard title="Eventos / seg" points={evRate?.points || []} unit="ev/s" color="#6ed28a" loading={tsLoading} />
      </div>
    </>
  );
}
