"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCuitProgressive } from "@/lib/cuit";

interface Empresa {
  id: string;
  nombre: string;
  cuit: string;
  contacto: { email?: string; telefono?: string; direccion?: string } | null;
  activa: boolean;
  createdAt: number;
  counts: { usuarios: number; rutas: number; reglas: number };
}

interface FormState {
  nombre: string;
  cuit: string;
  email: string;
  telefono: string;
  direccion: string;
}

const emptyForm: FormState = { nombre: "", cuit: "", email: "", telefono: "", direccion: "" };

export default function EmpresasView({ initial }: { initial: Empresa[] }) {
  const [empresas, setEmpresas] = useState<Empresa[]>(initial);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error" | "warning"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function flash(kind: "success" | "error" | "warning", text: string) {
    setFeedback({ kind, text });
    setTimeout(() => setFeedback(null), 5000);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const payload = {
      nombre: form.nombre,
      cuit: form.cuit,
      contacto: {
        email: form.email || undefined,
        telefono: form.telefono || undefined,
        direccion: form.direccion || undefined,
      },
    };

    try {
      const res = await fetch("/api/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        flash("error", data.error ?? "Error al crear empresa");
        return;
      }
      const list = await fetch("/api/empresas", { cache: "no-store" });
      const json = await list.json();
      setEmpresas(json.empresas.map(serialize));
      setForm(emptyForm);
      flash("success", `Empresa "${data.empresa.nombre}" creada correctamente`);
    } catch (err) {
      flash("error", "Error de red: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActiva(empresa: Empresa) {
    setBusyId(empresa.id);
    try {
      const res = await fetch(`/api/empresas/${empresa.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activa: !empresa.activa }),
      });
      const data = await res.json();
      if (!res.ok) {
        flash("error", data.error ?? "Error al actualizar");
        return;
      }
      setEmpresas((prev) =>
        prev
          .map((e) => (e.id === empresa.id ? serialize(data.empresa) : e))
          .sort((a, b) => (Number(b.activa) - Number(a.activa)) || a.nombre.localeCompare(b.nombre)),
      );
      flash("success", `Empresa "${empresa.nombre}" ${data.empresa.activa ? "activada" : "desactivada"}`);
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
          <h2>Empresas</h2>
          <div className="page-subtitle">Gestión de empresas logísticas registradas en el sistema</div>
        </div>
      </div>

      {feedback && (
        <div className={`feedback ${feedback.kind}`} role="alert" style={{ marginBottom: "1.25rem" }}>
          {feedback.text}
        </div>
      )}

      <div className="grid" style={{ marginBottom: "1.5rem" }}>
        <div className="col-12">
          <div className="admin-card">
            <div className="card-header">
              <h2>Nueva empresa</h2>
              <p className="last-update">Completá los datos para registrar una empresa logística</p>
            </div>

            <form onSubmit={handleCreate} className="form-grid">
              <div className="field-group">
                <label htmlFor="nombre">Nombre</label>
                <input
                  id="nombre"
                  type="text"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Logística Cuyo SA"
                />
              </div>
              <div className="field-group">
                <label htmlFor="cuit">CUIT</label>
                <input
                  id="cuit"
                  type="text"
                  required
                  value={form.cuit}
                  onChange={(e) => setForm({ ...form, cuit: formatCuitProgressive(e.target.value) })}
                  placeholder="30-71234567-8"
                  inputMode="numeric"
                  maxLength={13}
                />
              </div>
              <div className="field-group">
                <label htmlFor="email">Email de contacto</label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contacto@empresa.com.ar"
                />
              </div>
              <div className="field-group">
                <label htmlFor="telefono">Teléfono</label>
                <input
                  id="telefono"
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="+54 261 ..."
                />
              </div>
              <div className="field-group field-full">
                <label htmlFor="direccion">Dirección</label>
                <input
                  id="direccion"
                  type="text"
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  placeholder="San Martín 1234, Mendoza"
                />
              </div>
              <div className="field-full action-row">
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Guardando…" : "➕ Registrar empresa"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setForm(emptyForm)}
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
          <h2>Empresas registradas</h2>
          <p className="last-update">{empresas.length} empresa{empresas.length === 1 ? "" : "s"} en el sistema</p>
        </div>

        {empresas.length === 0 ? (
          <div className="empty-state">
            <strong>Todavía no hay empresas</strong>
            Cargá la primera con el formulario de arriba.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>CUIT</th>
                  <th>Contacto</th>
                  <th>Usuarios</th>
                  <th>Rutas</th>
                  <th>Reglas</th>
                  <th>Estado</th>
                  <th className="col-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/empresas/${e.id}`} className="row-link">
                        <strong>{e.nombre}</strong>
                      </Link>
                    </td>
                    <td className="mono">{e.cuit}</td>
                    <td className="muted">
                      {e.contacto?.email || e.contacto?.telefono || "—"}
                    </td>
                    <td>{e.counts.usuarios}</td>
                    <td>{e.counts.rutas}</td>
                    <td>{e.counts.reglas}</td>
                    <td>
                      <span className={`pill ${e.activa ? "pill-on" : "pill-off"}`}>
                        {e.activa ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="col-actions">
                      <button
                        className={`btn-sm ${e.activa ? "btn-danger" : ""}`}
                        onClick={() => toggleActiva(e)}
                        disabled={busyId === e.id}
                      >
                        {busyId === e.id ? "…" : e.activa ? "Desactivar" : "Activar"}
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

function serialize(e: {
  id: string;
  nombre: string;
  cuit: string;
  contacto: unknown;
  activa: boolean;
  createdAt: string | number | Date;
  _count?: { usuarios: number; rutas: number; reglas: number };
  counts?: { usuarios: number; rutas: number; reglas: number };
}): Empresa {
  return {
    id: e.id,
    nombre: e.nombre,
    cuit: e.cuit,
    contacto: e.contacto as Empresa["contacto"],
    activa: e.activa,
    createdAt: new Date(e.createdAt).getTime(),
    counts: e.counts ?? e._count ?? { usuarios: 0, rutas: 0, reglas: 0 },
  };
}
