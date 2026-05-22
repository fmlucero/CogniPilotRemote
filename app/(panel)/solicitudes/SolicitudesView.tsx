"use client";

// HU-25 — Lista de solicitudes de reset + modal con password generado al
// resolver. El admin entrega el password manualmente al usuario por canal
// seguro (mismo flujo que creación de usuario).

import { useEffect, useState } from "react";

export interface ResetRequest {
  id: string;
  email: string;
  ts: number;
  atendidaAt: number | null;
  atendidaPor: string | null;
  atendidaPorEmail: string | null;
  usuarioExiste: boolean;
}

interface ResolverResp {
  ok: boolean;
  email: string;
  nuevoPassword: string | null;
  usuarioId: string | null;
  mensaje: string;
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export default function SolicitudesView({ initial }: { initial: ResetRequest[] }) {
  const [list, setList] = useState<ResetRequest[]>(initial);
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ResolverResp | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const qs = soloPendientes ? "?soloPendientes=true" : "?soloPendientes=false";
      const res = await fetch(`/api/admin/reset-requests${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data: { requests: ResetRequest[] } = await res.json();
      setList(data.requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloPendientes]);

  async function resolver(req: ResetRequest) {
    const label = req.usuarioExiste
      ? `Generar nuevo password para ${req.email}?`
      : `El email ${req.email} no matchea ningún usuario. ¿Marcar atendida igual?`;
    if (!confirm(label)) return;

    setError(null);
    try {
      const res = await fetch(`/api/admin/reset-requests/${req.id}/resolver`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("HTTP " + res.status + ": " + (await res.text()).slice(0, 200));
      const data: ResolverResp = await res.json();
      setModal(data);
      setCopied(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function copyPassword() {
    if (!modal?.nuevoPassword) return;
    try {
      await navigator.clipboard.writeText(modal.nuevoPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // si falla, el admin lo lee a mano del modal
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Solicitudes de reset</h2>
          <div className="page-subtitle">
            Reset manual de contraseñas pedidas desde la pantalla de login.
            Al resolver, se genera un password nuevo y se muestra <strong>UNA SOLA VEZ</strong> para entregar al usuario.
          </div>
        </div>
      </div>

      {error && (
        <div className="admin-card" style={{ padding: ".75rem 1rem", marginBottom: "1rem", borderLeft: "3px solid var(--error)", color: "var(--error)" }}>
          ⚠ {error}
        </div>
      )}

      <div className="admin-card" style={{ padding: ".75rem 1.25rem", marginBottom: "1rem" }}>
        <label style={{ display: "flex", gap: ".4rem", alignItems: "center", fontSize: ".82rem", color: "var(--text-muted)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
          />
          Solo pendientes (sin atender)
        </label>
      </div>

      <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
        {loading && list.length === 0 ? (
          <div className="muted">Cargando…</div>
        ) : list.length === 0 ? (
          <div className="empty-state">
            <strong>{soloPendientes ? "Sin solicitudes pendientes 🎉" : "Sin solicitudes registradas"}</strong>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Email</th>
                  <th>¿Existe?</th>
                  <th>Estado</th>
                  <th>Atendida por</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} style={{ opacity: r.atendidaAt ? 0.6 : 1 }}>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.ts)}</td>
                    <td><strong>{r.email}</strong></td>
                    <td>
                      <span className={`pill ${r.usuarioExiste ? "pill-on" : "pill-warn"}`}>
                        {r.usuarioExiste ? "Sí" : "No matchea"}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${r.atendidaAt ? "pill-off" : "pill-warn"}`}>
                        {r.atendidaAt ? "Atendida" : "Pendiente"}
                      </span>
                    </td>
                    <td className="muted" style={{ fontSize: ".82rem" }}>
                      {r.atendidaAt ? (
                        <>
                          {r.atendidaPorEmail ?? r.atendidaPor?.slice(0, 8) ?? "—"}
                          <div style={{ fontSize: ".72rem", color: "var(--text-faint)" }}>{fmtDate(r.atendidaAt)}</div>
                        </>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td>
                      {!r.atendidaAt && (
                        <button onClick={() => resolver(r)} style={{ padding: ".3rem .7rem", background: "var(--accent)", color: "#000", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: ".82rem", fontWeight: 600 }}>
                          Resolver
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal con el password generado — se muestra UNA SOLA VEZ. */}
      {modal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9998,
          }}
          onClick={() => setModal(null)}
        >
          <div
            className="admin-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: "1.5rem",
              maxWidth: "30rem",
              width: "calc(100% - 2rem)",
              background: "var(--bg, #1a1a22)",
              border: "1px solid var(--accent)",
              borderRadius: "8px",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Solicitud resuelta</h2>
            <p style={{ fontSize: ".88rem", color: "var(--text-muted)" }}>{modal.mensaje}</p>

            <div style={{ margin: "1rem 0", padding: ".75rem", background: "var(--bg-elev)", borderRadius: "4px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: ".75rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".25rem" }}>Email</div>
              <div style={{ fontFamily: "var(--font-mono, monospace)", marginBottom: ".75rem" }}>{modal.email}</div>

              {modal.nuevoPassword && (
                <>
                  <div style={{ fontSize: ".75rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".25rem" }}>
                    Nuevo password (se muestra una sola vez)
                  </div>
                  <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
                    <code style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "1.05rem", background: "var(--bg)", padding: ".4rem .6rem", borderRadius: "4px", flex: 1 }}>
                      {modal.nuevoPassword}
                    </code>
                    <button
                      onClick={copyPassword}
                      style={{ padding: ".4rem .7rem", background: copied ? "var(--success, #2bb45f)" : "var(--accent)", color: "#000", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: ".82rem", fontWeight: 600 }}
                    >
                      {copied ? "✓ Copiado" : "Copiar"}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div style={{ textAlign: "right" }}>
              <button
                onClick={() => setModal(null)}
                style={{ padding: ".5rem 1rem", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "4px", cursor: "pointer" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
