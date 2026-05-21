"use client";

// HU-26 — Vista cliente de la home del supervisor.
// KPIs en vivo (online, activos hoy, eventos últimos 60min), mapa de su flota,
// listado de repartidores con badge de conexión y link al detalle.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FleetMap from "../components/FleetMap";
import {
  CONNECTION_LABEL,
  CONNECTION_PILL,
  lastSeenLabel,
  type ConnectionState,
} from "../usuarios/connection";

export interface RepartidorRow {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  dispositivos: number;
  connectionState: ConnectionState;
  lastSeen: number | null;
}

const KPI_POLL_MS = 15_000;

export default function SupervisorView({
  viewerNombre,
  empresaNombre,
  repartidores: initial,
}: {
  viewerNombre: string;
  empresaNombre: string;
  repartidores: RepartidorRow[];
}) {
  const [repartidores, setRepartidores] = useState<RepartidorRow[]>(initial);
  const [eventsLastHour, setEventsLastHour] = useState<number | null>(null);

  // Recompute KPIs derivados (online, activos hoy)
  const kpi = useMemo(() => {
    const online = repartidores.filter((r) => r.connectionState === "online").length;
    const activeToday = repartidores.filter((r) => r.connectionState !== "offline").length;
    return { online, activeToday, total: repartidores.length };
  }, [repartidores]);

  // Polling de repartidores (estado de conexión cambia con el tiempo)
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/usuarios", { cache: "no-store" });
        if (!res.ok) return;
        const data: { usuarios: { id: string; nombre: string; email: string; rol: string; activo: boolean; dispositivos: number; connectionState: RepartidorRow["connectionState"]; lastSeen: number | null }[] } = await res.json();
        if (!alive) return;
        const filtered = data.usuarios.filter((u) => u.rol === "repartidor");
        setRepartidores(filtered.map((u) => ({
          id: u.id, nombre: u.nombre, email: u.email, activo: u.activo,
          dispositivos: u.dispositivos, connectionState: u.connectionState, lastSeen: u.lastSeen,
        })));
      } catch (err) {
        console.warn("poll repartidores error", err);
      }
    }
    const id = window.setInterval(poll, KPI_POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  // Polling del KPI "eventos últimos 60 min"
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const from = Date.now() - 3600_000;
        const res = await fetch(`/api/events?from=${from}`, { cache: "no-store" });
        if (!res.ok) return;
        const data: { events: unknown[] } = await res.json();
        if (alive) setEventsLastHour(data.events.length);
      } catch (err) {
        console.warn("poll events error", err);
      }
    }
    poll();
    const id = window.setInterval(poll, KPI_POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Hola, {viewerNombre}</h2>
          <div className="page-subtitle">{empresaNombre} — vista en vivo de tu flota</div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: ".72rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".25rem" }}>Repartidores en línea</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 600, color: kpi.online > 0 ? "var(--success)" : "var(--text-faint)", lineHeight: 1.1 }}>
            {kpi.online} <span style={{ fontSize: "1rem", color: "var(--text-muted)" }}>/ {kpi.total}</span>
          </div>
          <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginTop: ".25rem" }}>menos de 5 min de inactividad</div>
        </div>
        <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: ".72rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".25rem" }}>Activos hoy</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 600, lineHeight: 1.1 }}>{kpi.activeToday}</div>
          <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginTop: ".25rem" }}>conexión en las últimas 24 h</div>
        </div>
        <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: ".72rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".25rem" }}>Eventos última hora</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 600, lineHeight: 1.1 }}>
            {eventsLastHour === null ? "…" : eventsLastHour.toLocaleString("es-AR")}
          </div>
          <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginTop: ".25rem" }}>
            <Link href="/dashboard" style={{ color: "var(--accent)" }}>ver feed en vivo →</Link>
          </div>
        </div>
      </div>

      {/* Mapa */}
      <FleetMap title="🗺️ Tu flota" />

      {/* Lista de repartidores */}
      <div className="admin-card" style={{ marginTop: "1.5rem", padding: "1rem 1.25rem" }}>
        <div className="card-header" style={{ marginBottom: ".75rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>👥 Tus repartidores</h2>
          <span style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>{repartidores.length} en total</span>
        </div>
        {repartidores.length === 0 ? (
          <div className="empty-state">
            <strong>Aún no tenés repartidores asignados</strong>
            Andá a <Link href="/usuarios" style={{ color: "var(--accent)" }}>Usuarios</Link> para crear el primero.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Conexión</th>
                  <th>Última actividad</th>
                  <th>Disp.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {repartidores.map((r) => (
                  <tr key={r.id} style={{ opacity: r.activo ? 1 : 0.55 }}>
                    <td>
                      <Link href={`/usuarios/${r.id}`} className="row-link">
                        <strong>{r.nombre}</strong>
                      </Link>
                    </td>
                    <td className="mono">{r.email}</td>
                    <td>
                      <span className={`pill ${CONNECTION_PILL[r.connectionState]}`} title={lastSeenLabel(r.lastSeen)}>
                        {CONNECTION_LABEL[r.connectionState]}
                      </span>
                    </td>
                    <td className="muted">{lastSeenLabel(r.lastSeen)}</td>
                    <td>{r.dispositivos}</td>
                    <td>
                      <Link href={`/usuarios/${r.id}`} style={{ color: "var(--accent)", fontSize: ".88rem" }}>detalle →</Link>
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
