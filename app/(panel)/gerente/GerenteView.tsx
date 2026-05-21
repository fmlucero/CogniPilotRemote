"use client";

// HU-27 + HU-14 + HU-16 — Home del gerente.
// Renderiza KPIs históricos con selector de rango, charts SVG y botón Export CSV.

import { useEffect, useMemo, useState } from "react";

export interface KpisData {
  range: { start: number; end: number };
  events_total: number;
  active_users: number;
  by_day: { date: string; count: number }[];
  by_type: { tipo: string; count: number }[];
  top_users: {
    usuarioId: string | null;
    usuarioNombre: string | null;
    empresaNombre: string | null;
    count: number;
  }[];
}

type Window = "24h" | "7d" | "30d" | "90d";
const WINDOW_DAYS: Record<Window, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 };
const WINDOW_LABEL: Record<Window, string> = { "24h": "Hoy", "7d": "7 días", "30d": "30 días", "90d": "90 días" };

const TYPE_LABEL: Record<string, string> = {
  app_opened: "App abierta",
  warning_shown: "Warning",
  scan_detected: "Escaneo detectado",
  user_continued: "Continuó igual",
  user_cancelled: "Canceló",
  global_app_opened: "App externa",
  global_clicked: "Click externo",
};
const TYPE_COLOR: Record<string, string> = {
  app_opened: "#6ed28a",
  warning_shown: "#f5a524",
  scan_detected: "#ef4d4d",
  user_continued: "#ef4d4d",
  user_cancelled: "#6ed28a",
  global_app_opened: "#8c8c92",
  global_clicked: "#8c8c92",
};

function rangeFromWindow(win: Window): { from: number; to: number } {
  const to = Date.now();
  const from = to - WINDOW_DAYS[win] * 86400 * 1000;
  return { from, to };
}

// ─── LineChart SVG ──────────────────────────────────────────────────────────

function LineChart({ points, height = 140 }: { points: { date: string; count: number }[]; height?: number }) {
  if (points.length === 0) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: ".85rem" }}>
        sin datos en el rango seleccionado
      </div>
    );
  }
  const max = Math.max(...points.map((p) => p.count), 1);
  const width = 100;
  const path = points.length === 1
    ? `M0,${(height - (points[0].count / max) * height).toFixed(2)} L${width},${(height - (points[0].count / max) * height).toFixed(2)}`
    : points.map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - (p.count / max) * height;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
        <defs>
          <linearGradient id="grad-line-day" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffe14d" stopOpacity=".25" />
            <stop offset="100%" stopColor="#ffe14d" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#grad-line-day)" />
        <path d={path} fill="none" stroke="#ffe14d" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".68rem", color: "var(--text-faint)", marginTop: ".25rem" }}>
        <span>{points[0].date}</span>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  );
}

// ─── BarChart (horizontal, divs) ────────────────────────────────────────────

function BarsByType({ byType }: { byType: { tipo: string; count: number }[] }) {
  if (byType.length === 0) {
    return <div style={{ color: "var(--text-faint)", fontSize: ".85rem", padding: "1rem 0" }}>sin datos en el rango.</div>;
  }
  const total = byType.reduce((s, x) => s + x.count, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: ".4rem" }}>
      {byType.map((t) => {
        const pct = total > 0 ? (t.count / total) * 100 : 0;
        const color = TYPE_COLOR[t.tipo] || "#5f5f63";
        return (
          <div key={t.tipo}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".78rem", marginBottom: "2px" }}>
              <span>{TYPE_LABEL[t.tipo] || t.tipo}</span>
              <span style={{ color: "var(--text-muted)" }}>{t.count.toLocaleString("es-AR")} <span style={{ color: "var(--text-faint)" }}>({pct.toFixed(0)}%)</span></span>
            </div>
            <div style={{ background: "#2a2d34", borderRadius: "3px", height: "8px", overflow: "hidden" }}>
              <div style={{ background: color, width: `${pct}%`, height: "100%" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

function Card({ title, value, sub, accent }: { title: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
      <div style={{ fontSize: ".72rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".25rem" }}>{title}</div>
      <div style={{ fontSize: "1.8rem", fontWeight: 600, color: accent || "var(--text)", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginTop: ".25rem" }}>{sub}</div>}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function GerenteView({
  viewerNombre, empresaNombre, initial,
}: {
  viewerNombre: string;
  empresaNombre: string;
  initial: KpisData;
}) {
  const [window, setWindow] = useState<Window>("7d");
  const [data, setData] = useState<KpisData>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-fetch al cambiar window
  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { from, to } = rangeFromWindow(window);
        const res = await fetch(`/api/metrics/kpis?from=${from}&to=${to}`, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json: KpisData = await res.json();
        if (alive) setData(json);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [window]);

  const eventsPerDayAvg = useMemo(() => {
    if (data.by_day.length === 0) return 0;
    return Math.round(data.events_total / data.by_day.length);
  }, [data]);

  function downloadCsv() {
    const { from, to } = rangeFromWindow(window);
    // Navegamos a la URL — el back devuelve content-disposition attachment.
    window === "24h"; // (no-op to silence linter sobre el shadowing si llegara)
    const url = `/api/reportes/eventos.csv?from=${from}&to=${to}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = ""; // que el back decida el filename
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Hola, {viewerNombre}</h2>
          <div className="page-subtitle">{empresaNombre} — análisis histórico</div>
        </div>
      </div>

      {/* Controles */}
      <div style={{ display: "flex", gap: ".5rem", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
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
        <button
          onClick={downloadCsv}
          style={{
            marginLeft: "auto",
            padding: ".4rem .9rem",
            fontSize: ".82rem",
            border: "1px solid var(--accent)",
            background: "var(--accent)",
            color: "#000",
            borderRadius: "4px",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 600,
          }}
        >
          ⬇ Descargar CSV
        </button>
      </div>

      {error && (
        <div className="admin-card" style={{ padding: ".75rem 1rem", marginBottom: "1rem", borderLeft: "3px solid var(--error)", color: "var(--error)" }}>
          ⚠️ Error cargando KPIs: {error}
        </div>
      )}

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <Card
          title="Eventos en el rango"
          value={loading ? "…" : data.events_total.toLocaleString("es-AR")}
          sub={`prom. ${eventsPerDayAvg.toLocaleString("es-AR")} por día`}
        />
        <Card
          title="Repartidores activos"
          value={loading ? "…" : data.active_users.toString()}
          sub="con al menos un evento en el rango"
        />
        <Card
          title="Tipos de evento"
          value={loading ? "…" : data.by_type.length.toString()}
          sub={`${WINDOW_LABEL[window]} analizados`}
        />
      </div>

      {/* Charts grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: ".82rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".5rem" }}>
            Eventos por día
          </div>
          <LineChart points={data.by_day} />
        </div>
        <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: ".82rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".75rem" }}>
            Distribución por tipo
          </div>
          <BarsByType byType={data.by_type} />
        </div>
      </div>

      {/* Top usuarios */}
      <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
        <div className="card-header" style={{ marginBottom: ".75rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>🏆 Top repartidores por actividad</h2>
          <span style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>top {data.top_users.length}</span>
        </div>
        {data.top_users.length === 0 ? (
          <div className="empty-state">
            <strong>Sin actividad en el rango</strong>
            Ampliá el rango o esperá a que entren eventos nuevos.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Repartidor</th>
                  <th>Empresa</th>
                  <th style={{ textAlign: "right" }}>Eventos</th>
                </tr>
              </thead>
              <tbody>
                {data.top_users.map((u, i) => (
                  <tr key={u.usuarioId ?? `null-${i}`}>
                    <td className="muted">{i + 1}</td>
                    <td><strong>{u.usuarioNombre ?? "(anónimo)"}</strong></td>
                    <td className="muted">{u.empresaNombre ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{u.count.toLocaleString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
