// HU-33 — Detalle completo de empresa para admin_sistema.
// Server Component: una sola llamada a /api/empresas/{id}/detalle.

import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import {
  CONNECTION_LABEL,
  CONNECTION_PILL,
  lastSeenLabel,
  type ConnectionState,
} from "../../usuarios/connection";
import UmbralEditor from "./UmbralEditor";

type Rol = "admin_sistema" | "supervisor" | "gerente" | "repartidor";

interface UsuarioSummary {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  connectionState: ConnectionState;
  lastSeen: number | null;
  dispositivos: number;
}

interface RutaSummary {
  id: string;
  nombre: string;
  fecha: string;
}

interface ReglaSummary {
  id: string;
  nombre: string;
  tipo: string;
  accion: string;
  activa: boolean;
  rutaId: string | null;
  updatedAt: number;
}

interface EmpresaDetail {
  id: string;
  nombre: string;
  cuit: string;
  contacto: { email?: string; telefono?: string; direccion?: string } | null;
  activa: boolean;
  createdAt: number;
  usuarios: UsuarioSummary[];
  rutas: RutaSummary[];
  reglas: ReglaSummary[];
  kpi: {
    events_total_7d: number;
    active_users_7d: number;
    devices_active_5m: number;
    devices_active_24h: number;
  };
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

const TIPO_REGLA_LABEL: Record<string, string> = {
  paquete_fuera_parada: "Paquete fuera de parada",
  ventana_horaria: "Ventana horaria",
};
const ACCION_LABEL: Record<string, string> = {
  bloquear: "Bloquear",
  alertar: "Alertar",
};

function fmtDateAbs(ms: number): string {
  return new Date(ms).toLocaleString("es-AR", {
    dateStyle: "medium",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function fmtMsRel(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return "hace segundos";
  if (s < 3600) return "hace " + Math.floor(s / 60) + " min";
  if (s < 86400) return "hace " + Math.floor(s / 3600) + " h";
  return "hace " + Math.floor(s / 86400) + " d";
}

export const dynamic = "force-dynamic";

export default async function EmpresaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin_sistema");
  const { id } = await params;

  let empresa: EmpresaDetail;
  try {
    empresa = await serverFetch<EmpresaDetail>(`/api/empresas/${id}/detalle`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("HTTP 404")) notFound();
    throw err;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>
            {empresa.nombre}{" "}
            <span className={`pill ${empresa.activa ? "pill-on" : "pill-off"}`} style={{ verticalAlign: "middle", marginLeft: ".4rem" }}>
              {empresa.activa ? "Activa" : "Inactiva"}
            </span>
          </h2>
          <div className="page-subtitle">
            <span className="mono">CUIT {empresa.cuit}</span>
            {empresa.contacto?.email && <> · {empresa.contacto.email}</>}
            {empresa.contacto?.telefono && <> · {empresa.contacto.telefono}</>}
            {empresa.contacto?.direccion && <> · {empresa.contacto.direccion}</>}
            <> · creada {fmtDateAbs(empresa.createdAt)}</>
          </div>
        </div>
        <Link href="/empresas" style={{ color: "var(--accent)", fontSize: ".88rem", alignSelf: "flex-start" }}>← Volver a empresas</Link>
      </div>

      {/* HU-12 — Umbral de alertas */}
      <UmbralEditor empresaId={empresa.id} />

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: ".72rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".25rem" }}>Eventos últimos 7d</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 600, lineHeight: 1.1 }}>{empresa.kpi.events_total_7d.toLocaleString("es-AR")}</div>
        </div>
        <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: ".72rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".25rem" }}>Usuarios activos 7d</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 600, lineHeight: 1.1 }}>{empresa.kpi.active_users_7d}</div>
          <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginTop: ".25rem" }}>de {empresa.usuarios.length} totales</div>
        </div>
        <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: ".72rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".25rem" }}>Dispositivos en línea</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 600, lineHeight: 1.1, color: empresa.kpi.devices_active_5m > 0 ? "var(--success)" : "var(--text-faint)" }}>{empresa.kpi.devices_active_5m}</div>
          <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginTop: ".25rem" }}>24 h: {empresa.kpi.devices_active_24h}</div>
        </div>
        <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: ".72rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".25rem" }}>Reglas activas</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 600, lineHeight: 1.1 }}>
            {empresa.reglas.filter((r) => r.activa).length}
            <span style={{ fontSize: "1rem", color: "var(--text-muted)" }}> / {empresa.reglas.length}</span>
          </div>
        </div>
      </div>

      {/* Usuarios */}
      <div className="admin-card" style={{ padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
        <div className="card-header" style={{ marginBottom: ".75rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>👥 Usuarios ({empresa.usuarios.length})</h2>
        </div>
        {empresa.usuarios.length === 0 ? (
          <div className="empty-state">
            <strong>Esta empresa no tiene usuarios</strong>
            Andá a <Link href="/usuarios" style={{ color: "var(--accent)" }}>Usuarios</Link> para crear el primero.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Conexión</th>
                  <th>Disp.</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {empresa.usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/usuarios/${u.id}`} className="row-link">
                        <strong>{u.nombre}</strong>
                      </Link>
                    </td>
                    <td className="mono">{u.email}</td>
                    <td><span className={`pill ${ROL_PILL[u.rol]}`}>{ROL_LABEL[u.rol]}</span></td>
                    <td>
                      <span className={`pill ${CONNECTION_PILL[u.connectionState]}`} title={lastSeenLabel(u.lastSeen)}>
                        {CONNECTION_LABEL[u.connectionState]}
                      </span>
                    </td>
                    <td>{u.dispositivos}</td>
                    <td>
                      <span className={`pill ${u.activo ? "pill-on" : "pill-off"}`}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rutas */}
      <div className="admin-card" style={{ padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
        <div className="card-header" style={{ marginBottom: ".75rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>🛣️ Rutas ({empresa.rutas.length})</h2>
        </div>
        {empresa.rutas.length === 0 ? (
          <div className="empty-state">
            <strong>Sin rutas cargadas</strong>
            Las rutas se asignan a repartidores y agrupan paradas/paquetes.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Nombre</th><th>Fecha</th></tr>
              </thead>
              <tbody>
                {empresa.rutas.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.nombre}</strong></td>
                    <td className="muted">{r.fecha}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reglas */}
      <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
        <div className="card-header" style={{ marginBottom: ".75rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>⚙️ Reglas ({empresa.reglas.length})</h2>
        </div>
        {empresa.reglas.length === 0 ? (
          <div className="empty-state">
            <strong>Sin reglas configuradas</strong>
            Las reglas controlan el comportamiento del sidecar Android.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Acción</th>
                  <th>Alcance</th>
                  <th>Última edición</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {empresa.reglas.map((r) => (
                  <tr key={r.id} style={{ opacity: r.activa ? 1 : 0.55 }}>
                    <td><strong>{r.nombre}</strong></td>
                    <td className="muted">{TIPO_REGLA_LABEL[r.tipo] ?? r.tipo}</td>
                    <td className="muted">{ACCION_LABEL[r.accion] ?? r.accion}</td>
                    <td className="muted">{r.rutaId ? "Por ruta" : "Empresa entera"}</td>
                    <td className="muted">{fmtMsRel(r.updatedAt)}</td>
                    <td>
                      <span className={`pill ${r.activa ? "pill-on" : "pill-off"}`}>
                        {r.activa ? "Activa" : "Inactiva"}
                      </span>
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
