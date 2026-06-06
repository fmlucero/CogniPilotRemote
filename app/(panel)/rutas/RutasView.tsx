"use client";

// HU-50 — CRUD de rutas (admin/supervisor/gerente). Tabla + form crear/editar
// con paradas anidadas (ventana horaria + lat/lng) y paquetes por parada.
// El mapa para ubicar las paradas llega en HU-51; por ahora lat/lng son inputs
// numéricos con default en Mendoza.

import { Fragment, useEffect, useState } from "react";
import ParadaMapPicker from "./ParadaMapPicker";

type Rol = "admin_sistema" | "supervisor" | "gerente" | "repartidor";

export interface EmpresaOption {
  id: string;
  nombre: string;
}

export interface RutaListItem {
  id: string;
  empresaId: string;
  empresaNombre: string | null;
  nombre: string;
  fecha: string; // YYYY-MM-DD
  paradasCount: number;
  paquetesCount: number;
  asignacionesCount: number;
}

interface AsignacionRow {
  id: string;
  rutaId: string;
  rutaNombre: string;
  empresaId: string;
  repartidorId: string;
  repartidorNombre: string;
  repartidorEmail: string;
  fecha: string;
}
interface RepartidorOption {
  id: string;
  nombre: string;
  email: string;
}

interface PaqueteDetail {
  id: string;
  codigoMl: string;
  descripcion: string | null;
}
interface ParadaDetail {
  id: string;
  orden: number;
  lat: number | string;
  lng: number | string;
  direccion: string | null;
  ventanaDesde: string | null;
  ventanaHasta: string | null;
  paquetes: PaqueteDetail[];
}
interface RutaDetail {
  id: string;
  empresaId: string;
  empresaNombre: string | null;
  nombre: string;
  fecha: string;
  paradas: ParadaDetail[];
  paquetesCount: number;
}

// ── Estado del form ───────────────────────────────────────────────────────
interface PaqueteForm {
  codigoMl: string;
  descripcion: string;
}
interface ParadaForm {
  direccion: string;
  lat: string;
  lng: string;
  ventanaDesde: string;
  ventanaHasta: string;
  paquetes: PaqueteForm[];
}
interface FormState {
  empresaId: string;
  nombre: string;
  fecha: string;
  paradas: ParadaForm[];
}

// Default de coordenadas: centro de Mendoza (hasta que HU-51 agregue el mapa).
const DEFAULT_LAT = "-32.8895";
const DEFAULT_LNG = "-68.8458";

function emptyParada(): ParadaForm {
  return {
    direccion: "",
    lat: DEFAULT_LAT,
    lng: DEFAULT_LNG,
    ventanaDesde: "",
    ventanaHasta: "",
    paquetes: [],
  };
}

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }); // en-CA → YYYY-MM-DD
}

function emptyForm(empresaId: string): FormState {
  return { empresaId, nombre: "", fecha: todayISO(), paradas: [emptyParada()] };
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: ".4rem .5rem",
  background: "var(--bg-elev)",
  border: "1px solid var(--border)",
  borderRadius: "4px",
  color: "var(--text)",
};
const labelTextStyle: React.CSSProperties = {
  fontSize: ".78rem",
  color: "var(--text-muted)",
  marginBottom: ".25rem",
};

export default function RutasView({
  initial,
  viewerRol,
  viewerEmpresaId,
  empresas,
}: {
  initial: RutaListItem[];
  viewerRol: Rol;
  viewerEmpresaId: string | null;
  empresas: EmpresaOption[];
}) {
  const [list, setList] = useState<RutaListItem[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // HU-51 — índice de la parada cuyo map picker está abierto (uno a la vez).
  const [mapOpenIdx, setMapOpenIdx] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(viewerRol !== "admin_sistema" && viewerEmpresaId ? viewerEmpresaId : ""),
  );

  // HU-52 — panel de asignaciones (una ruta abierta a la vez).
  const [asignOpenId, setAsignOpenId] = useState<string | null>(null);
  const [asignList, setAsignList] = useState<AsignacionRow[]>([]);
  const [repartidores, setRepartidores] = useState<RepartidorOption[]>([]);
  const [asignLoading, setAsignLoading] = useState(false);
  const [asignForm, setAsignForm] = useState<{ repartidorId: string; fecha: string }>({
    repartidorId: "",
    fecha: "",
  });

  useEffect(() => {
    if (viewerRol !== "admin_sistema" && viewerEmpresaId && form.empresaId === "") {
      setForm((f) => ({ ...f, empresaId: viewerEmpresaId }));
    }
  }, [viewerRol, viewerEmpresaId, form.empresaId]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rutas", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data: { rutas: RutaListItem[] } = await res.json();
      setList(data.rutas);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm(viewerRol !== "admin_sistema" && viewerEmpresaId ? viewerEmpresaId : ""));
    setFormOpen(true);
    setError(null);
  }

  async function openEdit(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/rutas/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const r: RutaDetail = await res.json();
      setEditingId(id);
      setForm({
        empresaId: r.empresaId,
        nombre: r.nombre,
        fecha: r.fecha,
        paradas: r.paradas.length
          ? r.paradas.map((p) => ({
              direccion: p.direccion ?? "",
              lat: String(p.lat),
              lng: String(p.lng),
              ventanaDesde: p.ventanaDesde ?? "",
              ventanaHasta: p.ventanaHasta ?? "",
              paquetes: p.paquetes.map((pq) => ({
                codigoMl: pq.codigoMl,
                descripcion: pq.descripcion ?? "",
              })),
            }))
          : [emptyParada()],
      });
      setFormOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  // ── helpers de edición de paradas/paquetes ───────────────────────────────
  function patchParada(i: number, patch: Partial<ParadaForm>) {
    setForm((f) => ({
      ...f,
      paradas: f.paradas.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    }));
  }
  function addParada() {
    setForm((f) => ({ ...f, paradas: [...f.paradas, emptyParada()] }));
  }
  function removeParada(i: number) {
    setForm((f) => ({ ...f, paradas: f.paradas.filter((_, idx) => idx !== i) }));
    setMapOpenIdx(null);
  }
  function addPaquete(i: number) {
    setForm((f) => ({
      ...f,
      paradas: f.paradas.map((p, idx) =>
        idx === i ? { ...p, paquetes: [...p.paquetes, { codigoMl: "", descripcion: "" }] } : p,
      ),
    }));
  }
  function patchPaquete(pi: number, qi: number, patch: Partial<PaqueteForm>) {
    setForm((f) => ({
      ...f,
      paradas: f.paradas.map((p, idx) =>
        idx === pi
          ? { ...p, paquetes: p.paquetes.map((q, jdx) => (jdx === qi ? { ...q, ...patch } : q)) }
          : p,
      ),
    }));
  }
  function removePaquete(pi: number, qi: number) {
    setForm((f) => ({
      ...f,
      paradas: f.paradas.map((p, idx) =>
        idx === pi ? { ...p, paquetes: p.paquetes.filter((_, jdx) => jdx !== qi) } : p,
      ),
    }));
  }

  function buildPayload(includeEmpresa: boolean): Record<string, unknown> {
    const paradas = form.paradas.map((p, i) => {
      const out: Record<string, unknown> = {
        orden: i + 1,
        lat: Number(p.lat),
        lng: Number(p.lng),
        paquetes: p.paquetes
          .filter((q) => q.codigoMl.trim())
          .map((q) => {
            const pq: Record<string, unknown> = { codigoMl: q.codigoMl.trim() };
            if (q.descripcion.trim()) pq.descripcion = q.descripcion.trim();
            return pq;
          }),
      };
      if (p.direccion.trim()) out.direccion = p.direccion.trim();
      if (p.ventanaDesde) out.ventanaDesde = p.ventanaDesde;
      if (p.ventanaHasta) out.ventanaHasta = p.ventanaHasta;
      return out;
    });
    const payload: Record<string, unknown> = {
      nombre: form.nombre.trim(),
      fecha: form.fecha,
      paradas,
    };
    if (includeEmpresa) payload.empresaId = form.empresaId;
    return payload;
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.nombre.trim()) return setError("El nombre es requerido");
    if (!form.fecha) return setError("La fecha es requerida");
    if (editingId === null && !form.empresaId) return setError("Empresa requerida");
    for (const [i, p] of form.paradas.entries()) {
      if (Number.isNaN(Number(p.lat)) || Number.isNaN(Number(p.lng))) {
        return setError(`Parada ${i + 1}: lat/lng inválidos`);
      }
    }

    setSaving(true);
    try {
      const isCreate = editingId === null;
      const res = await fetch(isCreate ? "/api/rutas" : `/api/rutas/${editingId}`, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(isCreate)),
      });
      if (!res.ok) throw new Error("HTTP " + res.status + ": " + (await res.text()).slice(0, 250));
      closeForm();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeRuta(r: RutaListItem) {
    if (!confirm(`¿Borrar la ruta "${r.nombre}" (${r.fecha})? Esta acción no se puede deshacer.`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/rutas/${r.id}`, { method: "DELETE" });
      if (!res.ok) {
        // El back devuelve 409 con detalle si tiene asignaciones/reglas.
        let msg = "HTTP " + res.status;
        try {
          const body = await res.json();
          if (body?.detail) msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
        } catch {
          /* noop */
        }
        throw new Error(msg);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // ── HU-52 asignaciones ────────────────────────────────────────────────────
  async function openAsign(r: RutaListItem) {
    if (asignOpenId === r.id) {
      setAsignOpenId(null);
      return;
    }
    setAsignOpenId(r.id);
    // La fecha de asignación es el DÍA DE TRABAJO del repartidor (lo que mira
    // "Mi Ruta" = hoy local), no la fecha de planificación de la ruta. Default a
    // hoy para que asignar "para hoy" sea el caso natural (ver I-26).
    setAsignForm({ repartidorId: "", fecha: todayISO() });
    setAsignLoading(true);
    setError(null);
    try {
      const [aRes, rRes] = await Promise.all([
        fetch(`/api/asignaciones?rutaId=${r.id}`, { cache: "no-store" }),
        fetch(`/api/asignaciones/repartidores?empresaId=${r.empresaId}`, { cache: "no-store" }),
      ]);
      if (!aRes.ok) throw new Error("asignaciones HTTP " + aRes.status);
      if (!rRes.ok) throw new Error("repartidores HTTP " + rRes.status);
      const a: { asignaciones: AsignacionRow[] } = await aRes.json();
      const rp: { repartidores: RepartidorOption[] } = await rRes.json();
      setAsignList(a.asignaciones);
      setRepartidores(rp.repartidores);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAsignLoading(false);
    }
  }

  async function addAsign(r: RutaListItem) {
    if (!asignForm.repartidorId) return setError("Elegí un repartidor");
    if (!asignForm.fecha) return setError("Elegí una fecha");
    setError(null);
    try {
      const res = await fetch("/api/asignaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rutaId: r.id, repartidorId: asignForm.repartidorId, fecha: asignForm.fecha }),
      });
      if (!res.ok) {
        let msg = "HTTP " + res.status;
        try {
          const b = await res.json();
          if (b?.detail) msg = typeof b.detail === "string" ? b.detail : JSON.stringify(b.detail);
        } catch {
          /* noop */
        }
        throw new Error(msg);
      }
      const created: AsignacionRow = await res.json();
      setAsignList((l) => [created, ...l]);
      setAsignForm((f) => ({ ...f, repartidorId: "" }));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function removeAsign(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/asignaciones/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      setAsignList((l) => l.filter((a) => a.id !== id));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const showEmpresaColumn = viewerRol === "admin_sistema";
  const colCount = showEmpresaColumn ? 7 : 6;

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Rutas</h2>
          <div className="page-subtitle">
            {viewerRol === "admin_sistema"
              ? "Planificación de rutas — todas las empresas"
              : "Planificación de rutas — tu empresa"}
          </div>
        </div>
        <button
          onClick={openCreate}
          style={{
            padding: ".5rem 1rem",
            background: "var(--accent)",
            color: "#000",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 600,
            fontSize: ".88rem",
          }}
        >
          + Nueva ruta
        </button>
      </div>

      {error && (
        <div
          className="admin-card"
          style={{ padding: ".75rem 1rem", marginBottom: "1rem", borderLeft: "3px solid var(--error)", color: "var(--error)" }}
        >
          ⚠ {error}
        </div>
      )}

      {formOpen && (
        <form onSubmit={submitForm} className="admin-card" style={{ padding: "1rem 1.25rem", marginBottom: "1rem", display: "grid", gap: ".75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{editingId === null ? "Crear ruta" : "Editar ruta"}</h3>
            <button type="button" onClick={closeForm} style={{ background: "transparent", color: "var(--text-muted)", border: "none", cursor: "pointer", fontSize: "1.4rem" }}>×</button>
          </div>

          <div style={{ display: "grid", gap: ".75rem", gridTemplateColumns: "1fr 1fr 1fr" }}>
            {editingId === null && (
              <label>
                <div style={labelTextStyle}>Empresa</div>
                <select
                  value={form.empresaId}
                  onChange={(e) => setForm({ ...form, empresaId: e.target.value })}
                  disabled={viewerRol !== "admin_sistema"}
                  required
                  style={inputStyle}
                >
                  <option value="">— Seleccionar —</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <div style={labelTextStyle}>Nombre</div>
              <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required style={inputStyle} />
            </label>
            <label>
              <div style={labelTextStyle}>Fecha</div>
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required style={inputStyle} />
            </label>
          </div>

          {/* Paradas */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: ".25rem" }}>
            <strong style={{ fontSize: ".9rem" }}>Paradas ({form.paradas.length})</strong>
            <button type="button" onClick={addParada} style={{ padding: ".3rem .7rem", background: "var(--bg-elev)", color: "var(--accent)", border: "1px solid var(--border)", borderRadius: "4px", cursor: "pointer", fontFamily: "inherit", fontSize: ".82rem" }}>
              + Agregar parada
            </button>
          </div>

          {form.paradas.map((p, i) => (
            <div key={i} className="admin-card" style={{ padding: ".75rem", background: "var(--bg-elev)", display: "grid", gap: ".5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Parada {i + 1}</strong>
                {form.paradas.length > 1 && (
                  <button type="button" onClick={() => removeParada(i)} style={{ background: "transparent", color: "var(--error)", border: "none", cursor: "pointer", fontSize: ".8rem" }}>Quitar parada</button>
                )}
              </div>
              <label>
                <div style={labelTextStyle}>Dirección (opcional)</div>
                <input type="text" value={p.direccion} onChange={(e) => patchParada(i, { direccion: e.target.value })} style={inputStyle} placeholder="Ej. Av. San Martín 1234, Mendoza" />
              </label>
              <div style={{ display: "grid", gap: ".5rem", gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                <label>
                  <div style={labelTextStyle}>Lat</div>
                  <input type="number" step="any" value={p.lat} onChange={(e) => patchParada(i, { lat: e.target.value })} required style={inputStyle} />
                </label>
                <label>
                  <div style={labelTextStyle}>Lng</div>
                  <input type="number" step="any" value={p.lng} onChange={(e) => patchParada(i, { lng: e.target.value })} required style={inputStyle} />
                </label>
                <label>
                  <div style={labelTextStyle}>Ventana desde</div>
                  <input type="time" value={p.ventanaDesde} onChange={(e) => patchParada(i, { ventanaDesde: e.target.value })} style={inputStyle} />
                </label>
                <label>
                  <div style={labelTextStyle}>Ventana hasta</div>
                  <input type="time" value={p.ventanaHasta} onChange={(e) => patchParada(i, { ventanaHasta: e.target.value })} style={inputStyle} />
                </label>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setMapOpenIdx(mapOpenIdx === i ? null : i)}
                  style={{ background: "transparent", color: "var(--accent)", border: "1px solid var(--border)", borderRadius: "4px", padding: ".3rem .7rem", cursor: "pointer", fontFamily: "inherit", fontSize: ".8rem" }}
                >
                  {mapOpenIdx === i ? "Ocultar mapa" : "📍 Ubicar en mapa"}
                </button>
              </div>
              {mapOpenIdx === i && (
                <ParadaMapPicker
                  lat={p.lat}
                  lng={p.lng}
                  onPick={(la, ln) => patchParada(i, { lat: String(la), lng: String(ln) })}
                  onClose={() => setMapOpenIdx(null)}
                />
              )}

              {/* Paquetes de la parada */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>Paquetes ({p.paquetes.length})</span>
                <button type="button" onClick={() => addPaquete(i)} style={{ background: "transparent", color: "var(--accent)", border: "none", cursor: "pointer", fontSize: ".8rem" }}>+ paquete</button>
              </div>
              {p.paquetes.map((q, j) => (
                <div key={j} style={{ display: "grid", gap: ".5rem", gridTemplateColumns: "1fr 2fr auto", alignItems: "center" }}>
                  <input type="text" value={q.codigoMl} onChange={(e) => patchPaquete(i, j, { codigoMl: e.target.value })} placeholder="Código ML" style={inputStyle} />
                  <input type="text" value={q.descripcion} onChange={(e) => patchPaquete(i, j, { descripcion: e.target.value })} placeholder="Descripción (opcional)" style={inputStyle} />
                  <button type="button" onClick={() => removePaquete(i, j)} style={{ background: "transparent", color: "var(--error)", border: "none", cursor: "pointer", fontSize: "1.1rem" }} title="Quitar paquete">×</button>
                </div>
              ))}
            </div>
          ))}

          <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end" }}>
            <button type="button" onClick={closeForm} style={{ padding: ".4rem .9rem", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "4px", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ padding: ".4rem .9rem", background: "var(--accent)", color: "#000", border: "none", borderRadius: "4px", cursor: saving ? "wait" : "pointer", fontFamily: "inherit", fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Guardando…" : editingId === null ? "Crear" : "Guardar"}
            </button>
          </div>
        </form>
      )}

      <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
        <div className="card-header" style={{ marginBottom: ".75rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>{loading ? "Cargando…" : `${list.length} rutas`}</h2>
        </div>

        {list.length === 0 && !loading ? (
          <div className="empty-state">
            <strong>Sin rutas creadas todavía</strong>
            Tocá "+ Nueva ruta" para empezar.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  {showEmpresaColumn && <th>Empresa</th>}
                  <th>Fecha</th>
                  <th>Paradas</th>
                  <th>Paquetes</th>
                  <th>Asignaciones</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td><strong>{r.nombre}</strong></td>
                      {showEmpresaColumn && <td className="muted">{r.empresaNombre ?? "—"}</td>}
                      <td className="muted">{r.fecha}</td>
                      <td>{r.paradasCount}</td>
                      <td>{r.paquetesCount}</td>
                      <td>{r.asignacionesCount}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button onClick={() => openEdit(r.id)} style={{ background: "transparent", color: "var(--accent)", border: "none", cursor: "pointer", fontSize: ".85rem", marginRight: ".5rem" }}>Editar</button>
                        <button onClick={() => openAsign(r)} style={{ background: "transparent", color: "var(--text-muted)", border: "none", cursor: "pointer", fontSize: ".85rem", marginRight: ".5rem" }}>{asignOpenId === r.id ? "Cerrar" : "Asignar"}</button>
                        <button onClick={() => removeRuta(r)} style={{ background: "transparent", color: "var(--error)", border: "none", cursor: "pointer", fontSize: ".85rem" }}>Borrar</button>
                      </td>
                    </tr>
                    {asignOpenId === r.id && (
                      <tr>
                        <td colSpan={colCount} style={{ background: "var(--bg-elev)" }}>
                          <div style={{ padding: ".75rem", display: "grid", gap: ".6rem" }}>
                            <strong style={{ fontSize: ".85rem" }}>Asignaciones de "{r.nombre}"</strong>
                            <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
                              <select
                                value={asignForm.repartidorId}
                                onChange={(e) => setAsignForm({ ...asignForm, repartidorId: e.target.value })}
                                style={{ ...inputStyle, width: "auto", minWidth: "16rem" }}
                              >
                                <option value="">— Repartidor —</option>
                                {repartidores.map((rp) => (
                                  <option key={rp.id} value={rp.id}>{rp.nombre} ({rp.email})</option>
                                ))}
                              </select>
                              <label style={{ display: "grid", gap: ".15rem" }}>
                                <span style={{ ...labelTextStyle, marginBottom: 0 }}>Día de trabajo</span>
                                <input
                                  type="date"
                                  value={asignForm.fecha}
                                  onChange={(e) => setAsignForm({ ...asignForm, fecha: e.target.value })}
                                  style={{ ...inputStyle, width: "auto" }}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => addAsign(r)}
                                style={{ padding: ".4rem .9rem", background: "var(--accent)", color: "#000", border: "none", borderRadius: "4px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: ".82rem" }}
                              >
                                Asignar
                              </button>
                              {repartidores.length === 0 && !asignLoading && (
                                <span className="muted" style={{ fontSize: ".8rem" }}>No hay repartidores en esta empresa.</span>
                              )}
                            </div>
                            {asignLoading ? (
                              <span className="muted">Cargando…</span>
                            ) : asignList.length === 0 ? (
                              <span className="muted">Sin asignaciones todavía.</span>
                            ) : (
                              <table style={{ width: "100%", fontSize: ".82rem" }}>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: "left" }}>Repartidor</th>
                                    <th style={{ textAlign: "left" }}>Email</th>
                                    <th style={{ textAlign: "left" }}>Fecha</th>
                                    <th></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {asignList.map((a) => (
                                    <tr key={a.id}>
                                      <td><strong>{a.repartidorNombre}</strong></td>
                                      <td className="muted">{a.repartidorEmail}</td>
                                      <td className="muted">{a.fecha}</td>
                                      <td>
                                        <button onClick={() => removeAsign(a.id)} style={{ background: "transparent", color: "var(--error)", border: "none", cursor: "pointer", fontSize: ".85rem" }}>Quitar</button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
