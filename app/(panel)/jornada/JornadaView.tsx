"use client";

// HU-43 — Pre-flight check: vista de listo/no-listo por dispositivo Android
// antes de que arranque la jornada.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DispositivoRow, PreflightStatus } from "../dispositivos/DispositivosView";

type Rol = "admin_sistema" | "supervisor" | "gerente" | "repartidor";
type PfFilter = "all" | PreflightStatus;

const PF_FILTER_LABEL: Record<PfFilter, string> = {
  all: "Todos",
  ready: "Listos",
  not_ready: "Con problemas",
  unknown: "Sin reportar",
};
const PF_PILL: Record<PreflightStatus, string> = {
  ready: "pill-on",
  not_ready: "pill-off",
  unknown: "pill-warn",
};
const PF_ICON: Record<PreflightStatus, string> = {
  ready: "🟢",
  not_ready: "🔴",
  unknown: "⚪",
};
const PF_LABEL: Record<PreflightStatus, string> = {
  ready: "Listo",
  not_ready: "Con problemas",
  unknown: "Sin reportar",
};

// Lo que la app Android reporta (HU-43). El back no obliga un set fijo —
// extras se aceptan y se ignoran acá. Estos son los flags que pintamos.
const CAPABILITY_LABELS: Array<[string, string, string]> = [
  ["overlay_ok", "Overlay", "Permiso para dibujar warnings sobre otras apps"],
  ["accessibility_ok", "Accesibilidad", "Servicio de accesibilidad activo (detecta SC Pack)"],
  ["location_perm", "Ubicación", "Permiso de GPS — necesario para aparecer en el mapa de flota"],
  ["notifications_perm", "Notificaciones", "Permiso para mostrar la notificación del monitor"],
  ["monitor_running", "Monitor", "Servicio foreground del monitor corriendo"],
];

function fmtAgo(ms: number | null): string {
  if (ms === null) return "nunca";
  const secs = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (secs < 60) return `hace ${secs}s`;
  if (secs < 3600) return `hace ${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `hace ${Math.floor(secs / 3600)}h`;
  return `hace ${Math.floor(secs / 86400)}d`;
}

function capCell(value: unknown): { icon: string; cls: string } {
  if (value === true) return { icon: "✓", cls: "pill-on" };
  if (value === false) return { icon: "✗", cls: "pill-off" };
  return { icon: "?", cls: "pill-warn" };
}

export default function JornadaView({
  initial,
  viewerRol,
}: {
  initial: DispositivoRow[];
  viewerRol: Rol;
}) {
  const [list, setList] = useState<DispositivoRow[]>(initial);
  const [pfFilter, setPfFilter] = useState<PfFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  // Auto-refresh cada 30s — un supervisor puede tener esta página abierta
  // mientras los repartidores se preparan para arrancar.
  const REFRESH_MS = 30_000;

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (pfFilter !== "all") qs.set("preflight", pfFilter);
        const url = "/api/devices" + (qs.toString() ? `?${qs}` : "");
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data: { dispositivos: DispositivoRow[] } = await res.json();
        if (alive) setList(data.dispositivos);
      } catch {
        // ignore — mantenemos lo último
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    timer = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [pfFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((d) =>
      d.usuarioNombre.toLowerCase().includes(q) ||
      d.usuarioEmail.toLowerCase().includes(q) ||
      (d.empresaNombre ?? "").toLowerCase().includes(q),
    );
  }, [list, query]);

  // Para el banner — siempre contamos sobre LA LISTA RECIBIDA (que ya viene
  // filtrada por el back con el scope del usuario), no el filtro local.
  const counts = useMemo(() => {
    const ready = list.filter((d) => d.preflightStatus === "ready").length;
    const notReady = list.filter((d) => d.preflightStatus === "not_ready").length;
    const unknown = list.filter((d) => d.preflightStatus === "unknown").length;
    return { ready, notReady, unknown, total: list.length };
  }, [list]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Pre-jornada</h2>
          <div className="page-subtitle">
            {viewerRol === "admin_sistema"
              ? "Estado de los dispositivos de todas las empresas antes de la jornada"
              : "Estado de los dispositivos de tu empresa antes de la jornada"}
          </div>
        </div>
      </div>

      {/* Banner X de Y listos */}
      <div className="admin-card" style={{
        padding: "1rem 1.25rem",
        marginBottom: "1rem",
        display: "flex",
        gap: "1.5rem",
        alignItems: "center",
        flexWrap: "wrap",
        borderLeft: "4px solid " + (
          counts.total === 0 ? "var(--text-faint)"
          : counts.ready === counts.total ? "var(--success, #2bb45f)"
          : counts.notReady > 0 ? "var(--error, #d94a4a)"
          : "var(--warning, #d9a04a)"
        ),
      }}>
        <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>
          {counts.ready} <span style={{ fontSize: "1rem", fontWeight: 400, color: "var(--text-muted)" }}>de {counts.total} listos para jornada</span>
        </div>
        <div style={{ display: "flex", gap: "1rem", fontSize: ".85rem", color: "var(--text-muted)" }}>
          <span>🟢 {counts.ready} listos</span>
          <span>🔴 {counts.notReady} con problemas</span>
          <span>⚪ {counts.unknown} sin reportar (no abrieron la app en 24h)</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="admin-card" style={{ padding: ".75rem 1.25rem", marginBottom: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
          <span style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Estado:</span>
          {(Object.keys(PF_FILTER_LABEL) as PfFilter[]).map((c) => (
            <button
              key={c}
              onClick={() => setPfFilter(c)}
              style={{
                padding: ".25rem .65rem",
                fontSize: ".8rem",
                border: "1px solid " + (pfFilter === c ? "var(--accent)" : "var(--border)"),
                background: pfFilter === c ? "var(--accent)" : "transparent",
                color: pfFilter === c ? "#000" : "var(--text-muted)",
                borderRadius: "4px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {PF_FILTER_LABEL[c]}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Buscar por repartidor o empresa..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: 1, minWidth: "240px",
            padding: ".4rem .7rem",
            fontSize: ".88rem",
            background: "var(--bg-elev)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            color: "var(--text)",
            fontFamily: "inherit",
          }}
        />
        <span style={{ marginLeft: "auto", fontSize: ".78rem", color: "var(--text-faint)" }}>
          {loading ? "Actualizando…" : "Refresca cada 30s"}
        </span>
      </div>

      <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
        {filtered.length === 0 && !loading ? (
          <div className="empty-state">
            <strong>Sin dispositivos en este filtro</strong>
            Probá cambiar el filtro o limpiar la búsqueda.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Repartidor</th>
                  <th>Empresa</th>
                  <th>Estado</th>
                  {CAPABILITY_LABELS.map(([key, label, hint]) => (
                    <th key={key} title={hint} style={{ textAlign: "center" }}>{label}</th>
                  ))}
                  <th>Último report</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} style={{ opacity: d.activo ? 1 : 0.55 }}>
                    <td>
                      <Link href={`/usuarios/${d.usuarioId}`} className="row-link">
                        <strong>{d.usuarioNombre}</strong>
                      </Link>
                      <div style={{ fontSize: ".75rem", color: "var(--text-faint)" }}>{d.usuarioEmail}</div>
                    </td>
                    <td className="muted">{d.empresaNombre ?? "—"}</td>
                    <td>
                      <span className={`pill ${PF_PILL[d.preflightStatus]}`} title={d.capabilitiesUpdatedAt ? `Reportado ${fmtAgo(d.capabilitiesUpdatedAt)}` : "Nunca reportó"}>
                        {PF_ICON[d.preflightStatus]} {PF_LABEL[d.preflightStatus]}
                      </span>
                    </td>
                    {CAPABILITY_LABELS.map(([key]) => {
                      const v = (d.capabilities as Record<string, unknown> | null)?.[key];
                      const { icon, cls } = capCell(v);
                      return (
                        <td key={key} style={{ textAlign: "center" }}>
                          <span className={`pill ${cls}`} style={{ minWidth: "1.6rem", display: "inline-block" }}>{icon}</span>
                        </td>
                      );
                    })}
                    <td className="muted" style={{ fontSize: ".82rem" }}>
                      {fmtAgo(d.capabilitiesUpdatedAt)}
                    </td>
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
