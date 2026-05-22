"use client";

// HU-04 — CRUD de reglas (admin/supervisor). Tabla + form crear/editar +
// toggle activa + panel de historial colapsable por regla.

import { useEffect, useMemo, useState } from "react";

export type TipoRegla = "paquete_fuera_parada" | "ventana_horaria" | "app_bloqueada_en_horario";
export type AccionRegla = "bloquear" | "alertar";

export interface Regla {
  id: string;
  empresaId: string;
  empresaNombre: string | null;
  rutaId: string | null;
  rutaNombre: string | null;
  nombre: string;
  tipo: TipoRegla;
  accion: AccionRegla;
  condicion: Record<string, unknown>;
  activa: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface EmpresaOption {
  id: string;
  nombre: string;
}

interface HistorialEntry {
  id: string;
  ts: number;
  usuarioId: string;
  usuarioEmail: string | null;
  campo: string;
  valorOld: unknown;
  valorNew: unknown;
}

type Rol = "admin_sistema" | "supervisor" | "gerente" | "repartidor";

const TIPO_LABEL: Record<TipoRegla, string> = {
  paquete_fuera_parada: "Paquete fuera de parada",
  ventana_horaria: "Ventana horaria",
  app_bloqueada_en_horario: "App bloqueada en horario",
};
const ACCION_LABEL: Record<AccionRegla, string> = {
  bloquear: "Bloquear",
  alertar: "Alertar",
};
const ACCION_PILL: Record<AccionRegla, string> = {
  bloquear: "pill-off",
  alertar: "pill-warn",
};

const EMPTY_FORM = {
  empresaId: "",
  rutaId: "",
  nombre: "",
  tipo: "paquete_fuera_parada" as TipoRegla,
  accion: "alertar" as AccionRegla,
  condicionJson: "{}",
  activa: true,
};

type FormState = typeof EMPTY_FORM;

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function ReglasView({
  initial,
  viewerRol,
  viewerEmpresaId,
  empresas,
}: {
  initial: Regla[];
  viewerRol: Rol;
  viewerEmpresaId: string | null;
  empresas: EmpresaOption[];
}) {
  const [list, setList] = useState<Regla[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistorialEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // HU-06 — filtros de rango de fechas para el historial.
  const [historyFrom, setHistoryFrom] = useState<string>("");
  const [historyTo, setHistoryTo] = useState<string>("");

  // Default empresa pre-cargada para supervisor
  useEffect(() => {
    if (viewerRol === "supervisor" && viewerEmpresaId && form.empresaId === "") {
      setForm((f) => ({ ...f, empresaId: viewerEmpresaId }));
    }
  }, [viewerRol, viewerEmpresaId, form.empresaId]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reglas", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data: { reglas: Regla[] } = await res.json();
      setList(data.reglas);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      empresaId: viewerRol === "supervisor" && viewerEmpresaId ? viewerEmpresaId : "",
    });
    setFormOpen(true);
  }

  function openEdit(r: Regla) {
    setEditingId(r.id);
    setForm({
      empresaId: r.empresaId,
      rutaId: r.rutaId ?? "",
      nombre: r.nombre,
      tipo: r.tipo,
      accion: r.accion,
      condicionJson: JSON.stringify(r.condicion, null, 2),
      activa: r.activa,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let condicion: Record<string, unknown>;
    try {
      condicion = JSON.parse(form.condicionJson || "{}");
      if (typeof condicion !== "object" || Array.isArray(condicion) || condicion === null) {
        throw new Error("debe ser un objeto JSON");
      }
    } catch (e) {
      setError(`Condición JSON inválida: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    const payload: Record<string, unknown> = {
      nombre: form.nombre,
      tipo: form.tipo,
      accion: form.accion,
      condicion,
      activa: form.activa,
    };
    if (form.rutaId.trim()) payload.rutaId = form.rutaId.trim();

    try {
      if (editingId === null) {
        payload.empresaId = form.empresaId;
        if (!payload.empresaId) {
          setError("Empresa requerida");
          return;
        }
        const res = await fetch("/api/reglas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("HTTP " + res.status + ": " + (await res.text()).slice(0, 200));
      } else {
        // En PATCH no se envía empresaId (el back hace extra=forbid).
        const res = await fetch(`/api/reglas/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("HTTP " + res.status + ": " + (await res.text()).slice(0, 200));
      }
      closeForm();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggleActiva(r: Regla) {
    try {
      const res = await fetch(`/api/reglas/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activa: !r.activa }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function removeRegla(r: Regla) {
    if (!confirm(`¿Borrar la regla "${r.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/reglas/${r.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      if (historyOpenId === r.id) setHistoryOpenId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function loadHistory(reglaId: string, from: string, to: string) {
    setHistoryLoading(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", new Date(from).getTime().toString());
      if (to) qs.set("to", new Date(to).getTime().toString());
      const url = `/api/reglas/${reglaId}/historial` + (qs.toString() ? `?${qs}` : "");
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data: { historial: HistorialEntry[] } = await res.json();
      setHistory(data.historial);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openHistory(reglaId: string) {
    if (historyOpenId === reglaId) {
      setHistoryOpenId(null);
      return;
    }
    setHistoryOpenId(reglaId);
    setHistoryFrom("");
    setHistoryTo("");
    await loadHistory(reglaId, "", "");
  }

  const showEmpresaColumn = viewerRol === "admin_sistema";

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Reglas</h2>
          <div className="page-subtitle">
            {viewerRol === "admin_sistema"
              ? "Motor de reglas configurable — todas las empresas"
              : "Motor de reglas configurable — tu empresa"}
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
          + Nueva regla
        </button>
      </div>

      {error && (
        <div className="admin-card" style={{ padding: ".75rem 1rem", marginBottom: "1rem", borderLeft: "3px solid var(--error)", color: "var(--error)" }}>
          ⚠ {error}
        </div>
      )}

      {formOpen && (
        <form onSubmit={submitForm} className="admin-card" style={{ padding: "1rem 1.25rem", marginBottom: "1rem", display: "grid", gap: ".75rem", gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
              {editingId === null ? "Crear regla" : `Editar regla`}
            </h3>
            <button type="button" onClick={closeForm} style={{ background: "transparent", color: "var(--text-muted)", border: "none", cursor: "pointer", fontSize: "1.4rem" }}>×</button>
          </div>

          {editingId === null && (
            <label>
              <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginBottom: ".25rem" }}>Empresa</div>
              <select
                value={form.empresaId}
                onChange={(e) => setForm({ ...form, empresaId: e.target.value })}
                disabled={viewerRol === "supervisor"}
                required
                style={{ width: "100%", padding: ".4rem .5rem", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)" }}
              >
                <option value="">— Seleccionar —</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            </label>
          )}

          <label>
            <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginBottom: ".25rem" }}>Nombre</div>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
              style={{ width: "100%", padding: ".4rem .5rem", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)" }}
            />
          </label>

          <label>
            <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginBottom: ".25rem" }}>Tipo</div>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoRegla })}
              style={{ width: "100%", padding: ".4rem .5rem", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)" }}
            >
              {(Object.keys(TIPO_LABEL) as TipoRegla[]).map((t) => (
                <option key={t} value={t}>{TIPO_LABEL[t]}</option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginBottom: ".25rem" }}>Acción</div>
            <select
              value={form.accion}
              onChange={(e) => setForm({ ...form, accion: e.target.value as AccionRegla })}
              style={{ width: "100%", padding: ".4rem .5rem", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)" }}
            >
              {(Object.keys(ACCION_LABEL) as AccionRegla[]).map((a) => (
                <option key={a} value={a}>{ACCION_LABEL[a]}</option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginBottom: ".25rem" }}>Ruta ID (opcional)</div>
            <input
              type="text"
              value={form.rutaId}
              onChange={(e) => setForm({ ...form, rutaId: e.target.value })}
              placeholder="vacío = aplica a toda la empresa"
              style={{ width: "100%", padding: ".4rem .5rem", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)" }}
            />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginBottom: ".25rem" }}>Condición (JSON)</div>
            <textarea
              value={form.condicionJson}
              onChange={(e) => setForm({ ...form, condicionJson: e.target.value })}
              rows={5}
              style={{ width: "100%", padding: ".4rem .5rem", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)", fontFamily: "var(--font-mono, monospace)", fontSize: ".82rem" }}
              spellCheck={false}
            />
          </label>

          <label style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={form.activa}
              onChange={(e) => setForm({ ...form, activa: e.target.checked })}
            />
            <span>Activa</span>
          </label>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: ".5rem", justifyContent: "flex-end" }}>
            <button type="button" onClick={closeForm} style={{ padding: ".4rem .9rem", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "4px", cursor: "pointer", fontFamily: "inherit" }}>
              Cancelar
            </button>
            <button type="submit" style={{ padding: ".4rem .9rem", background: "var(--accent)", color: "#000", border: "none", borderRadius: "4px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
              {editingId === null ? "Crear" : "Guardar"}
            </button>
          </div>
        </form>
      )}

      <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
        <div className="card-header" style={{ marginBottom: ".75rem" }}>
          <h2 style={{ fontSize: "1.1rem" }}>{loading ? "Cargando…" : `${list.length} reglas`}</h2>
        </div>

        {list.length === 0 && !loading ? (
          <div className="empty-state">
            <strong>Sin reglas creadas todavía</strong>
            Tocá "+ Nueva regla" para empezar.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  {showEmpresaColumn && <th>Empresa</th>}
                  <th>Tipo</th>
                  <th>Acción</th>
                  <th>Ruta</th>
                  <th>Condición</th>
                  <th>Activa</th>
                  <th>Modificada</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <>
                    <tr key={r.id} style={{ opacity: r.activa ? 1 : 0.6 }}>
                      <td><strong>{r.nombre}</strong></td>
                      {showEmpresaColumn && <td className="muted">{r.empresaNombre ?? "—"}</td>}
                      <td>
                        <span className="pill pill-on" style={{ fontSize: ".75rem" }}>{TIPO_LABEL[r.tipo]}</span>
                      </td>
                      <td>
                        <span className={`pill ${ACCION_PILL[r.accion]}`} style={{ fontSize: ".75rem" }}>{ACCION_LABEL[r.accion]}</span>
                      </td>
                      <td className="muted">{r.rutaNombre ?? (r.rutaId ? r.rutaId.slice(0, 8) + "…" : "(toda la empresa)")}</td>
                      <td className="muted" style={{ fontFamily: "var(--font-mono, monospace)", fontSize: ".78rem", maxWidth: "20rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={JSON.stringify(r.condicion)}>
                        {Object.keys(r.condicion).length === 0 ? "—" : JSON.stringify(r.condicion)}
                      </td>
                      <td>
                        <button onClick={() => toggleActiva(r)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }} title="Click para alternar">
                          <span className={`pill ${r.activa ? "pill-on" : "pill-off"}`}>{r.activa ? "Sí" : "No"}</span>
                        </button>
                      </td>
                      <td className="muted" style={{ fontSize: ".78rem" }}>{fmtDate(r.updatedAt)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button onClick={() => openEdit(r)} style={{ background: "transparent", color: "var(--accent)", border: "none", cursor: "pointer", fontSize: ".85rem", marginRight: ".5rem" }}>Editar</button>
                        <button onClick={() => openHistory(r.id)} style={{ background: "transparent", color: "var(--text-muted)", border: "none", cursor: "pointer", fontSize: ".85rem", marginRight: ".5rem" }}>{historyOpenId === r.id ? "Cerrar" : "Historial"}</button>
                        <button onClick={() => removeRegla(r)} style={{ background: "transparent", color: "var(--error)", border: "none", cursor: "pointer", fontSize: ".85rem" }}>Borrar</button>
                      </td>
                    </tr>
                    {historyOpenId === r.id && (
                      <tr>
                        <td colSpan={showEmpresaColumn ? 9 : 8} style={{ background: "var(--bg-elev)" }}>
                          <div style={{ padding: ".75rem" }}>
                            <div style={{ display: "flex", gap: ".75rem", alignItems: "center", marginBottom: ".5rem", flexWrap: "wrap" }}>
                              <strong style={{ fontSize: ".85rem" }}>Historial de cambios</strong>
                              <span style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>Desde:</span>
                              <input
                                type="date"
                                value={historyFrom}
                                onChange={(e) => {
                                  setHistoryFrom(e.target.value);
                                  loadHistory(r.id, e.target.value, historyTo);
                                }}
                                style={{ padding: ".2rem .4rem", fontSize: ".8rem", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)" }}
                              />
                              <span style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>Hasta:</span>
                              <input
                                type="date"
                                value={historyTo}
                                onChange={(e) => {
                                  setHistoryTo(e.target.value);
                                  loadHistory(r.id, historyFrom, e.target.value);
                                }}
                                style={{ padding: ".2rem .4rem", fontSize: ".8rem", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)" }}
                              />
                              {(historyFrom || historyTo) && (
                                <button
                                  onClick={() => { setHistoryFrom(""); setHistoryTo(""); loadHistory(r.id, "", ""); }}
                                  style={{ padding: ".2rem .5rem", fontSize: ".78rem", background: "transparent", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-muted)", cursor: "pointer" }}
                                >
                                  Limpiar
                                </button>
                              )}
                            </div>
                            {historyLoading ? (
                              <span className="muted">Cargando…</span>
                            ) : history.length === 0 ? (
                              <span className="muted">Sin historial en el rango.</span>
                            ) : (
                              <table style={{ width: "100%", fontSize: ".82rem" }}>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: "left" }}>Fecha</th>
                                    <th style={{ textAlign: "left" }}>Usuario</th>
                                    <th style={{ textAlign: "left" }}>Campo</th>
                                    <th style={{ textAlign: "left" }}>Antes</th>
                                    <th style={{ textAlign: "left" }}>Después</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {history.map((h) => (
                                    <tr key={h.id}>
                                      <td className="muted">{fmtDate(h.ts)}</td>
                                      <td className="muted">{h.usuarioEmail ?? h.usuarioId.slice(0, 8)}</td>
                                      <td>{h.campo}</td>
                                      <td className="muted">{fmtVal(h.valorOld)}</td>
                                      <td><strong>{fmtVal(h.valorNew)}</strong></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
