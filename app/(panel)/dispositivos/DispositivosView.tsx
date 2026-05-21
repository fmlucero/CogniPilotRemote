"use client";

// HU-35 — Listado plano de dispositivos con filtros interactivos.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CONNECTION_LABEL,
  CONNECTION_PILL,
  lastSeenLabel,
  type ConnectionState,
} from "../usuarios/connection";

export interface DispositivoRow {
  id: string;
  deviceUuid: string;
  modelo: string | null;
  osVersion: string | null;
  appVersion: string | null;
  activo: boolean;
  lastSeen: number;
  lastLat: number | null;
  lastLng: number | null;
  createdAt: number;
  connectionState: ConnectionState;
  usuarioId: string;
  usuarioNombre: string;
  usuarioEmail: string;
  usuarioRol: "admin_sistema" | "supervisor" | "gerente" | "repartidor";
  empresaId: string | null;
  empresaNombre: string | null;
}

type Rol = "admin_sistema" | "supervisor" | "gerente" | "repartidor";
type ConnFilter = "all" | ConnectionState;
type ActivoFilter = "all" | "activo" | "inactivo";

const CONN_FILTER_LABEL: Record<ConnFilter, string> = {
  all: "Todos",
  online: "En línea",
  active_today: "Activos hoy",
  offline: "Desconectados",
};
const ACTIVO_FILTER_LABEL: Record<ActivoFilter, string> = {
  all: "Todos",
  activo: "Activos",
  inactivo: "Inactivos",
};

export default function DispositivosView({
  initial,
  viewerRol,
}: {
  initial: DispositivoRow[];
  viewerRol: Rol;
}) {
  const [list, setList] = useState<DispositivoRow[]>(initial);
  const [connFilter, setConnFilter] = useState<ConnFilter>("all");
  const [activoFilter, setActivoFilter] = useState<ActivoFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Refetch al cambiar filtros server-side (conn + activo). El query de texto
  // se hace client-side sobre la lista recibida.
  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (connFilter !== "all") qs.set("conexion", connFilter);
        if (activoFilter !== "all") qs.set("activo", activoFilter === "activo" ? "true" : "false");
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
    return () => { alive = false; };
  }, [connFilter, activoFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((d) =>
      d.usuarioNombre.toLowerCase().includes(q) ||
      d.usuarioEmail.toLowerCase().includes(q) ||
      d.deviceUuid.toLowerCase().includes(q) ||
      (d.modelo ?? "").toLowerCase().includes(q)
    );
  }, [list, query]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Dispositivos</h2>
          <div className="page-subtitle">
            {viewerRol === "admin_sistema"
              ? "Parque móvil completo del sistema"
              : "Dispositivos de tu empresa"}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="admin-card" style={{ padding: ".75rem 1.25rem", marginBottom: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
          <span style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Conexión:</span>
          {(Object.keys(CONN_FILTER_LABEL) as ConnFilter[]).map((c) => (
            <button
              key={c}
              onClick={() => setConnFilter(c)}
              style={{
                padding: ".25rem .65rem",
                fontSize: ".8rem",
                border: "1px solid " + (connFilter === c ? "var(--accent)" : "var(--border)"),
                background: connFilter === c ? "var(--accent)" : "transparent",
                color: connFilter === c ? "#000" : "var(--text-muted)",
                borderRadius: "4px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {CONN_FILTER_LABEL[c]}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
          <span style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Estado:</span>
          {(Object.keys(ACTIVO_FILTER_LABEL) as ActivoFilter[]).map((a) => (
            <button
              key={a}
              onClick={() => setActivoFilter(a)}
              style={{
                padding: ".25rem .65rem",
                fontSize: ".8rem",
                border: "1px solid " + (activoFilter === a ? "var(--accent)" : "var(--border)"),
                background: activoFilter === a ? "var(--accent)" : "transparent",
                color: activoFilter === a ? "#000" : "var(--text-muted)",
                borderRadius: "4px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {ACTIVO_FILTER_LABEL[a]}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Buscar por usuario, email, modelo o UUID..."
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
      </div>

      <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
        <div className="card-header" style={{ marginBottom: ".75rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>
            {loading ? "Cargando…" : `${filtered.length} de ${list.length} dispositivos`}
          </h2>
        </div>

        {filtered.length === 0 && !loading ? (
          <div className="empty-state">
            <strong>Sin dispositivos en los filtros actuales</strong>
            Probá cambiar los filtros o limpiar la búsqueda.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Repartidor</th>
                  <th>Empresa</th>
                  <th>Modelo</th>
                  <th>OS / App</th>
                  <th>Conexión</th>
                  <th>Última vez</th>
                  <th>Estado</th>
                  <th>UUID</th>
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
                    <td className="muted">{d.modelo ?? "—"}</td>
                    <td className="muted">
                      <div>{d.osVersion ?? "—"}</div>
                      <div style={{ fontSize: ".75rem", color: "var(--text-faint)" }}>{d.appVersion ?? "—"}</div>
                    </td>
                    <td>
                      <span className={`pill ${CONNECTION_PILL[d.connectionState]}`} title={lastSeenLabel(d.lastSeen)}>
                        {CONNECTION_LABEL[d.connectionState]}
                      </span>
                    </td>
                    <td className="muted">{lastSeenLabel(d.lastSeen)}</td>
                    <td>
                      <span className={`pill ${d.activo ? "pill-on" : "pill-off"}`}>
                        {d.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: ".72rem", color: "var(--text-faint)" }} title={d.deviceUuid}>
                      {d.deviceUuid.length > 16 ? d.deviceUuid.slice(0, 14) + "…" : d.deviceUuid}
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
