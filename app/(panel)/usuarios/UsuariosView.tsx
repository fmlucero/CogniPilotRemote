"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CONNECTION_LABEL,
  CONNECTION_PILL,
  lastSeenLabel,
  type ConnectionState,
} from "./connection";

type Rol = "admin_sistema" | "supervisor" | "gerente" | "repartidor";

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  empresaId: string | null;
  empresaNombre: string | null;
  activo: boolean;
  dispositivos: number;
  connectionState: ConnectionState;
  lastSeen: number | null;
  createdAt: number;
}

interface Empresa { id: string; nombre: string; }

interface FormState {
  nombre: string;
  email: string;
  rol: Rol;
  empresaId: string;
  password: string;
  autoGen: boolean;
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

export default function UsuariosView({
  initial,
  empresas,
  viewerRol,
  viewerId,
  viewerEmpresaId,
}: {
  initial: Usuario[];
  empresas: Empresa[];
  viewerRol: Rol;
  viewerId: string;
  viewerEmpresaId: string | null;
}) {
  const isAdmin = viewerRol === "admin_sistema";

  const defaultForm: FormState = {
    nombre: "",
    email: "",
    rol: isAdmin ? "repartidor" : "repartidor",
    empresaId: isAdmin ? "" : (viewerEmpresaId ?? ""),
    password: "",
    autoGen: true,
  };

  const [usuarios, setUsuarios] = useState<Usuario[]>(initial);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error" | "warning"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [credsView, setCredsView] = useState<{ email: string; password: string } | null>(null);

  function flash(kind: "success" | "error" | "warning", text: string) {
    setFeedback({ kind, text });
    setTimeout(() => setFeedback(null), 6000);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const payload: Record<string, unknown> = {
      nombre: form.nombre,
      email: form.email,
      rol: form.rol,
    };
    if (form.rol !== "admin_sistema") {
      payload.empresaId = form.empresaId;
    }
    if (!form.autoGen && form.password) {
      payload.password = form.password;
    }

    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        flash("error", data.error ?? "Error al crear usuario");
        return;
      }
      setUsuarios((prev) => [data.usuario, ...prev]);
      setCredsView({ email: data.usuario.email, password: data.tempPassword });
      setForm(defaultForm);
      flash("success", `Usuario "${data.usuario.nombre}" creado correctamente`);
    } catch (err) {
      flash("error", "Error de red: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  }

  async function patchUsuario(usuario: Usuario, payload: Record<string, unknown>, optimistic?: Partial<Usuario>) {
    setBusyId(usuario.id);
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        flash("error", data.error ?? "Error al actualizar");
        return null;
      }
      setUsuarios((prev) => prev.map((u) => (u.id === usuario.id ? data.usuario : u)));
      if (optimistic) flash("success", `Cambios guardados`);
      return data;
    } catch (err) {
      flash("error", "Error de red: " + (err instanceof Error ? err.message : String(err)));
      return null;
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActivo(u: Usuario) {
    const data = await patchUsuario(u, { activo: !u.activo });
    if (data) flash("success", `Usuario ${data.usuario.activo ? "activado" : "desactivado"}`);
  }

  async function resetPassword(u: Usuario) {
    if (!confirm(`¿Generar nueva contraseña para ${u.email}?`)) return;
    const data = await patchUsuario(u, { resetPassword: true });
    if (data?.tempPassword) {
      setCredsView({ email: u.email, password: data.tempPassword });
      flash("success", "Contraseña reseteada — copiala antes de cerrar el cartel");
    }
  }

  // HU-34 — Impersonar al usuario y redirigir a su home.
  async function impersonate(u: Usuario) {
    if (!confirm(`Vas a entrar como ${u.nombre} (${u.rol}). Vas a ver el sistema como esa persona hasta que cliquees "Volver a mi cuenta" en el banner amarillo. ¿Seguir?`)) return;
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/auth/impersonate/${u.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { detail?: string }));
        flash("error", "No se pudo impersonar: " + (body.detail ?? `HTTP ${res.status}`));
        return;
      }
      const data: { user: { rol: Rol } } = await res.json();
      // Redirigir a la home del rol target — la cookie cp_at ya fue reemplazada por el back.
      const home = data.user.rol === "supervisor" ? "/supervisor" : "/gerente";
      window.location.href = home;
    } catch (err) {
      flash("error", "Error de red: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Usuarios</h2>
          <div className="page-subtitle">
            {isAdmin
              ? "Supervisores, gerentes y repartidores del sistema"
              : "Repartidores asignados a tu empresa"}
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`feedback ${feedback.kind}`} role="alert" style={{ marginBottom: "1.25rem" }}>
          {feedback.text}
        </div>
      )}

      {credsView && (
        <div className="admin-card" style={{ marginBottom: "1.25rem", borderColor: "var(--accent)" }}>
          <div className="card-header">
            <h2>🔑 Credenciales generadas</h2>
            <p className="last-update">
              Copiá la contraseña — se muestra una sola vez. Pasala al usuario por canal seguro.
            </p>
          </div>
          <div className="creds-block">
            <div className="creds-row">
              <span className="creds-label">Email</span>
              <code className="creds-value">{credsView.email}</code>
            </div>
            <div className="creds-row">
              <span className="creds-label">Contraseña</span>
              <code className="creds-value">{credsView.password}</code>
              <button
                type="button"
                className="btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(credsView.password);
                  flash("success", "Contraseña copiada al portapapeles");
                }}
              >
                Copiar
              </button>
            </div>
          </div>
          <div className="action-row">
            <button type="button" className="btn-ghost" onClick={() => setCredsView(null)}>
              Cerrar cartel
            </button>
          </div>
        </div>
      )}

      <div className="grid" style={{ marginBottom: "1.5rem" }}>
        <div className="col-12">
          <div className="admin-card">
            <div className="card-header">
              <h2>Nuevo usuario</h2>
              <p className="last-update">
                {isAdmin
                  ? "Elegí rol y empresa; la contraseña se genera automáticamente si dejás vacío"
                  : "Solo podés crear repartidores en tu propia empresa"}
              </p>
            </div>

            <form onSubmit={handleCreate} className="form-grid">
              <div className="field-group">
                <label htmlFor="u-nombre">Nombre completo</label>
                <input
                  id="u-nombre"
                  type="text"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Juan Pérez"
                />
              </div>
              <div className="field-group">
                <label htmlFor="u-email">Email</label>
                <input
                  id="u-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="juan@logisticacuyo.com.ar"
                />
              </div>

              <div className="field-group">
                <label htmlFor="u-rol">Rol</label>
                <select
                  id="u-rol"
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}
                  disabled={!isAdmin}
                >
                  {isAdmin && <option value="admin_sistema">{ROL_LABEL.admin_sistema}</option>}
                  {isAdmin && <option value="supervisor">{ROL_LABEL.supervisor}</option>}
                  {isAdmin && <option value="gerente">{ROL_LABEL.gerente}</option>}
                  <option value="repartidor">{ROL_LABEL.repartidor}</option>
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="u-empresa">Empresa</label>
                <select
                  id="u-empresa"
                  value={form.empresaId}
                  onChange={(e) => setForm({ ...form, empresaId: e.target.value })}
                  disabled={form.rol === "admin_sistema" || !isAdmin}
                  required={form.rol !== "admin_sistema"}
                >
                  <option value="">{form.rol === "admin_sistema" ? "Sin empresa (transversal)" : "Seleccionar..."}</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="field-full">
                <label className="toggle-label" htmlFor="u-autogen">
                  <span>Generar contraseña automáticamente</span>
                  <div className="toggle-wrapper">
                    <input
                      id="u-autogen"
                      type="checkbox"
                      checked={form.autoGen}
                      onChange={(e) => setForm({ ...form, autoGen: e.target.checked })}
                    />
                    <span className="toggle-track"><span className="toggle-thumb" /></span>
                  </div>
                </label>
              </div>

              {!form.autoGen && (
                <div className="field-group field-full">
                  <label htmlFor="u-pass">Contraseña inicial</label>
                  <input
                    id="u-pass"
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 8 caracteres"
                    minLength={8}
                  />
                </div>
              )}

              <div className="field-full action-row">
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Creando…" : "➕ Crear usuario"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setForm(defaultForm)}
                  disabled={submitting}
                >
                  Limpiar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="card-header">
          <h2>{isAdmin ? "Usuarios registrados" : "Repartidores de tu empresa"}</h2>
          <p className="last-update">{usuarios.length} usuario{usuarios.length === 1 ? "" : "s"}</p>
        </div>

        {usuarios.length === 0 ? (
          <div className="empty-state">
            <strong>No hay usuarios todavía</strong>
            Cargá el primero con el formulario de arriba.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Empresa</th>
                  <th>Disp.</th>
                  <th>Conexión</th>
                  <th>Estado</th>
                  <th className="col-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/usuarios/${u.id}`} className="row-link">
                        <strong>{u.nombre}</strong>
                      </Link>
                    </td>
                    <td className="mono">{u.email}</td>
                    <td>
                      <span className={`pill ${ROL_PILL[u.rol]}`}>{ROL_LABEL[u.rol]}</span>
                    </td>
                    <td className="muted">{u.empresaNombre ?? "—"}</td>
                    <td>{u.dispositivos}</td>
                    <td>
                      <span
                        className={`pill ${CONNECTION_PILL[u.connectionState]}`}
                        title={lastSeenLabel(u.lastSeen)}
                      >
                        {CONNECTION_LABEL[u.connectionState]}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${u.activo ? "pill-on" : "pill-off"}`}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="col-actions">
                      <button
                        className="btn-sm"
                        onClick={() => resetPassword(u)}
                        disabled={busyId === u.id}
                        title="Generar nueva contraseña"
                      >
                        🔑 Reset
                      </button>
                      {isAdmin && u.activo && (u.rol === "supervisor" || u.rol === "gerente") && (
                        <button
                          className="btn-sm"
                          style={{ marginLeft: "0.4rem" }}
                          onClick={() => impersonate(u)}
                          disabled={busyId === u.id}
                          title="Ver el sistema como esta persona (HU-34)"
                        >
                          🎭 Impersonar
                        </button>
                      )}
                      <button
                        className={`btn-sm ${u.activo ? "btn-danger" : ""}`}
                        style={{ marginLeft: "0.4rem" }}
                        onClick={() => toggleActivo(u)}
                        disabled={busyId === u.id || u.id === viewerId}
                        title={u.id === viewerId ? "No podés desactivar tu propio usuario" : ""}
                      >
                        {busyId === u.id ? "…" : u.activo ? "Desactivar" : "Activar"}
                      </button>
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
