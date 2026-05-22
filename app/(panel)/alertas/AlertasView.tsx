"use client";

// HU-12 — Tabla de alertas con filtro soloNoLeidas + marcar leída individual
// o todas. Auto-refresh cada 30s (mismo intervalo que el banner global).

import Link from "next/link";
import { useEffect, useState } from "react";

type Rol = "admin_sistema" | "supervisor" | "gerente" | "repartidor";

interface AlertaRow {
  id: string;
  ts: number;
  empresaId: string;
  empresaNombre: string | null;
  repartidorId: string | null;
  repartidorNombre: string | null;
  repartidorEmail: string | null;
  tipo: string;
  payload: Record<string, unknown> | null;
  leida: boolean;
  leidaPor: string | null;
  leidaAt: number | null;
}

interface AlertasResponse {
  alertas: AlertaRow[];
  unreadCount: number;
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

const TIPO_LABEL: Record<string, string> = {
  umbral_errores: "Umbral de errores",
};

export default function AlertasView({ viewerRol }: { viewerRol: Rol }) {
  const [data, setData] = useState<AlertasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [soloNoLeidas, setSoloNoLeidas] = useState(true);

  async function load() {
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: "100" });
      if (soloNoLeidas) qs.set("soloNoLeidas", "true");
      const res = await fetch(`/api/alertas?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json: AlertasResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloNoLeidas]);

  async function leer(id: string) {
    try {
      const res = await fetch(`/api/alertas/${id}/leer`, { method: "PATCH" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function leerTodas() {
    if (!confirm("¿Marcar TODAS las alertas no leídas de tu scope como leídas?")) return;
    try {
      const res = await fetch(`/api/alertas/leer-todas`, { method: "PATCH" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const alertas = data?.alertas ?? [];

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Alertas</h2>
          <div className="page-subtitle">
            {viewerRol === "admin_sistema"
              ? `Alertas operativas de toda la flota — ${data?.unreadCount ?? 0} sin leer`
              : `Alertas operativas de tu empresa — ${data?.unreadCount ?? 0} sin leer`}
          </div>
        </div>
        {(data?.unreadCount ?? 0) > 0 && (
          <button
            onClick={leerTodas}
            style={{
              padding: ".5rem 1rem",
              background: "var(--accent)",
              color: "#000",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: ".88rem",
              alignSelf: "flex-start",
            }}
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="admin-card" style={{ padding: ".75rem 1.25rem", marginBottom: "1rem", display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: ".4rem", alignItems: "center", fontSize: ".82rem", color: "var(--text-muted)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={soloNoLeidas}
            onChange={(e) => setSoloNoLeidas(e.target.checked)}
          />
          Solo no leídas
        </label>
        <span style={{ marginLeft: "auto", fontSize: ".78rem", color: "var(--text-faint)" }}>Auto-refresh cada 30s</span>
      </div>

      {error && (
        <div className="admin-card" style={{ padding: ".75rem 1rem", marginBottom: "1rem", borderLeft: "3px solid var(--error)", color: "var(--error)" }}>
          ⚠ {error}
        </div>
      )}

      <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
        {loading && alertas.length === 0 ? (
          <div className="muted">Cargando…</div>
        ) : alertas.length === 0 ? (
          <div className="empty-state">
            <strong>{soloNoLeidas ? "Sin alertas no leídas 🎉" : "Sin alertas en el rango"}</strong>
            {soloNoLeidas && "Todo tranquilo. Si llega una nueva aparece automáticamente."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Tipo</th>
                  <th>Repartidor</th>
                  {viewerRol === "admin_sistema" && <th>Empresa</th>}
                  <th>Detalle</th>
                  <th>Ubicación</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((a) => {
                  const p = (a.payload ?? {}) as { errores_hoy?: number; umbral?: number; lat?: number | null; lng?: number | null };
                  return (
                    <tr key={a.id} style={{ opacity: a.leida ? 0.55 : 1 }}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(a.ts)}</td>
                      <td>
                        <span className="pill pill-warn" style={{ fontSize: ".78rem" }}>
                          {TIPO_LABEL[a.tipo] ?? a.tipo}
                        </span>
                      </td>
                      <td>
                        {a.repartidorId ? (
                          <Link href={`/usuarios/${a.repartidorId}`} className="row-link">
                            <strong>{a.repartidorNombre ?? a.repartidorEmail ?? a.repartidorId.slice(0, 8)}</strong>
                          </Link>
                        ) : <span className="muted">—</span>}
                        {a.repartidorEmail && <div style={{ fontSize: ".74rem", color: "var(--text-faint)" }}>{a.repartidorEmail}</div>}
                      </td>
                      {viewerRol === "admin_sistema" && <td className="muted">{a.empresaNombre ?? "—"}</td>}
                      <td className="muted">
                        {a.tipo === "umbral_errores" && p.errores_hoy !== undefined
                          ? `${p.errores_hoy} errores (umbral: ${p.umbral})`
                          : JSON.stringify(p)}
                      </td>
                      <td>
                        {p.lat != null && p.lng != null ? (
                          <a
                            href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--accent)", fontSize: ".82rem", fontFamily: "var(--font-mono, monospace)" }}
                          >
                            {p.lat.toFixed(4)}, {p.lng.toFixed(4)} ↗
                          </a>
                        ) : <span className="muted">(sin GPS)</span>}
                      </td>
                      <td>
                        <span className={`pill ${a.leida ? "pill-off" : "pill-warn"}`}>
                          {a.leida ? "Leída" : "Sin leer"}
                        </span>
                      </td>
                      <td>
                        {!a.leida && (
                          <button onClick={() => leer(a.id)} style={{ background: "transparent", color: "var(--accent)", border: "none", cursor: "pointer", fontSize: ".85rem" }}>
                            Marcar leída
                          </button>
                        )}
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
