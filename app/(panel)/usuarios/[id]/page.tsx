import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import {
  CONNECTION_LABEL,
  CONNECTION_PILL,
  lastSeenAbsolute,
  lastSeenLabel,
  type ConnectionState,
} from "../connection";

interface DispositivoSummary {
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
}

interface AsignacionSummary {
  id: string;
  rutaId: string;
  rutaNombre: string;
  fecha: string; // YYYY-MM-DD
}

type TipoEvento =
  | "app_opened"
  | "warning_shown"
  | "scan_detected"
  | "user_continued"
  | "user_cancelled"
  | "global_app_opened"
  | "global_clicked";

interface EventoSummary {
  id: string;
  tipo: TipoEvento;
  ts: number;
  screenName: string | null;
  appPackage: string | null;
  inSchedule: boolean | null;
}

type Rol = "admin_sistema" | "supervisor" | "gerente" | "repartidor";

interface UsuarioDetail {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  empresaId: string | null;
  empresaNombre: string | null;
  activo: boolean;
  connectionState: ConnectionState;
  lastSeen: number | null;
  createdAt: number;
  dispositivos: DispositivoSummary[];
  asignaciones: AsignacionSummary[];
  eventosRecientes: EventoSummary[];
}

const ROL_LABEL: Record<Rol, string> = {
  admin_sistema: "Admin del sistema",
  supervisor: "Supervisor",
  gerente: "Gerente",
  repartidor: "Repartidor",
};
const ROL_PILL: Record<Rol, string> = {
  admin_sistema: "rol-admin",
  supervisor: "rol-supervisor",
  gerente: "rol-gerente",
  repartidor: "rol-repartidor",
};

const EVENTO_LABEL: Record<TipoEvento, { icon: string; text: string }> = {
  app_opened:        { icon: "🚚", text: "App abierta" },
  warning_shown:     { icon: "🟠", text: "Cartel naranja" },
  scan_detected:     { icon: "🚫", text: "Cartel rojo (escaneo)" },
  user_continued:    { icon: "⚠️", text: "Continuó igual" },
  user_cancelled:    { icon: "✅", text: "Canceló" },
  global_app_opened: { icon: "📱", text: "App externa abierta" },
  global_clicked:    { icon: "👆", text: "Click externo" },
};

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export const dynamic = "force-dynamic";

export default async function UsuarioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin_sistema", "supervisor");
  const { id } = await params;

  let usuario: UsuarioDetail;
  try {
    usuario = await serverFetch<UsuarioDetail>(`/api/usuarios/${id}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("HTTP 404")) notFound();
    if (msg.includes("HTTP 403")) {
      return (
        <>
          <div className="page-header">
            <div>
              <h2>Usuario</h2>
              <div className="page-subtitle">Acceso restringido</div>
            </div>
          </div>
          <div className="admin-card">
            <p style={{ color: "var(--text-faint)", padding: "2rem 0", textAlign: "center" }}>
              No tenés permiso para ver este usuario.
            </p>
          </div>
        </>
      );
    }
    throw err;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ marginBottom: "0.4rem" }}>
            <Link href="/usuarios" className="row-link" style={{ color: "var(--text-faint)", fontSize: "0.9rem" }}>
              ← Volver a usuarios
            </Link>
          </div>
          <h2>{usuario.nombre}</h2>
          <div className="page-subtitle">{usuario.email}</div>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: "1.25rem" }}>
        <div className="card-header">
          <h2>Datos del usuario</h2>
          <p className="last-update">
            Creado {fmtTime(usuario.createdAt)}
            {usuario.lastSeen
              ? <> · Última actividad <strong>{lastSeenLabel(usuario.lastSeen)}</strong> ({lastSeenAbsolute(usuario.lastSeen)})</>
              : <> · Sin actividad registrada</>}
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
          <span className={`pill ${ROL_PILL[usuario.rol]}`}>{ROL_LABEL[usuario.rol]}</span>
          <span className={`pill ${usuario.activo ? "pill-on" : "pill-off"}`}>
            {usuario.activo ? "Activo" : "Inactivo"}
          </span>
          <span className={`pill ${CONNECTION_PILL[usuario.connectionState]}`}>
            {CONNECTION_LABEL[usuario.connectionState]}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
          <div>
            <div className="sidebar-section-label">Empresa</div>
            <div>{usuario.empresaNombre ?? "—"}</div>
          </div>
          <div>
            <div className="sidebar-section-label">ID</div>
            <code className="mono" style={{ fontSize: "0.85rem" }}>{usuario.id}</code>
          </div>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: "1.25rem" }}>
        <div className="card-header">
          <h2>📱 Dispositivos ({usuario.dispositivos.length})</h2>
          <p className="last-update">Dispositivos Android registrados por este usuario</p>
        </div>
        {usuario.dispositivos.length === 0 ? (
          <div className="empty-state">
            <strong>Sin dispositivos registrados</strong>
            El usuario nunca inició sesión en la app móvil.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device UUID</th>
                  <th>Modelo</th>
                  <th>Android</th>
                  <th>App</th>
                  <th>Última conexión</th>
                  <th>Ubicación</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {usuario.dispositivos.map((d) => (
                  <tr key={d.id}>
                    <td className="mono" title={d.deviceUuid} style={{ fontSize: "0.8rem" }}>
                      {d.deviceUuid.slice(0, 8)}…
                    </td>
                    <td>{d.modelo ?? "—"}</td>
                    <td className="muted">{d.osVersion ?? "—"}</td>
                    <td className="muted">{d.appVersion ?? "—"}</td>
                    <td title={lastSeenAbsolute(d.lastSeen)}>{lastSeenLabel(d.lastSeen)}</td>
                    <td>
                      {d.lastLat !== null && d.lastLng !== null ? (
                        <a
                          href={`https://www.google.com/maps?q=${d.lastLat},${d.lastLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Abrir ${d.lastLat.toFixed(6)}, ${d.lastLng.toFixed(6)} en Google Maps`}
                          style={{ color: "var(--accent)", fontSize: "0.82rem", fontFamily: "var(--font-mono, monospace)" }}
                        >
                          {d.lastLat.toFixed(4)}, {d.lastLng.toFixed(4)} ↗
                        </a>
                      ) : (
                        <span className="muted" style={{ fontSize: "0.82rem" }}>(sin GPS)</span>
                      )}
                    </td>
                    <td>
                      <span className={`pill ${d.activo ? "pill-on" : "pill-off"}`}>
                        {d.activo ? "Activo" : "Baja"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-card" style={{ marginBottom: "1.25rem" }}>
        <div className="card-header">
          <h2>🗺️ Asignaciones recientes ({usuario.asignaciones.length})</h2>
          <p className="last-update">Últimas 20 rutas asignadas (ordenadas por fecha desc)</p>
        </div>
        {usuario.asignaciones.length === 0 ? (
          <div className="empty-state">
            <strong>Sin asignaciones</strong>
            {usuario.rol === "repartidor"
              ? "El repartidor no tiene rutas asignadas todavía."
              : "Las asignaciones aplican solo a repartidores."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Ruta</th>
                </tr>
              </thead>
              <tbody>
                {usuario.asignaciones.map((a) => (
                  <tr key={a.id}>
                    <td>{fmtDate(a.fecha)}</td>
                    <td><strong>{a.rutaNombre}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-card">
        <div className="card-header">
          <h2>📊 Eventos recientes ({usuario.eventosRecientes.length})</h2>
          <p className="last-update">Últimos 30 eventos enviados por sus dispositivos</p>
        </div>
        {usuario.eventosRecientes.length === 0 ? (
          <div className="empty-state">
            <strong>Sin eventos</strong>
            Todavía no se registraron eventos para este usuario.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Tipo</th>
                  <th>Pantalla</th>
                  <th>App</th>
                  <th>En horario</th>
                </tr>
              </thead>
              <tbody>
                {usuario.eventosRecientes.map((e) => {
                  const label = EVENTO_LABEL[e.tipo] ?? { icon: "•", text: e.tipo };
                  return (
                    <tr key={e.id}>
                      <td title={fmtTime(e.ts)}>{lastSeenLabel(e.ts)}</td>
                      <td>
                        <span className="event-icon">{label.icon}</span> {label.text}
                      </td>
                      <td className="muted">{e.screenName ?? "—"}</td>
                      <td className="muted">{e.appPackage ?? "—"}</td>
                      <td>
                        {e.inSchedule === null
                          ? <span className="muted">—</span>
                          : e.inSchedule
                            ? <span className="pill pill-on">Sí</span>
                            : <span className="pill pill-off">No</span>}
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
