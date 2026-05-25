"use client";

// HU-49 — Versión y build leídos de /api/system/version (público).
// Auto-refresh manual (botón). Es info estática del deploy actual — no tiene
// sentido refrescar polling. Sí refresca el server_time para visualizar drift.

import Link from "next/link";
import { useEffect, useState } from "react";

interface Runtime {
  python: string;
  platform: string;
  postgres: string;
  redis: string;
}

interface Response {
  service: string;
  git_commit: string;
  git_commit_short: string;
  build_time: string;
  runtime: Runtime;
  server_time: number;
}

const GITHUB_BASE = "https://github.com/fmlucero/CogniPilotBack/commit/";
const TZ = "America/Argentina/Buenos_Aires";

function fmtBuild(iso: string): string {
  if (iso === "unknown" || !iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "medium", timeZone: TZ });
  } catch {
    return iso;
  }
}

function fmtAge(iso: string): string {
  if (iso === "unknown" || !iso) return "";
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const d = Math.floor(ms / 86_400_000);
    const h = Math.floor((ms % 86_400_000) / 3_600_000);
    if (d > 0) return `hace ${d}d ${h}h`;
    if (h > 0) return `hace ${h}h`;
    const m = Math.floor(ms / 60_000);
    return `hace ${m}m`;
  } catch {
    return "";
  }
}

export default function VersionView() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/system/version", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const d: Response = await res.json();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Versión y build</h2>
          <div className="page-subtitle">
            Commit, build time y versiones de runtime del back-api en producción
          </div>
        </div>
        <Link href="/sistema" style={{ color: "var(--accent)", fontSize: ".88rem", alignSelf: "flex-start" }}>
          ← Volver a Infraestructura
        </Link>
      </div>

      {error && (
        <div className="admin-card" style={{ padding: ".75rem 1rem", marginBottom: "1rem", borderLeft: "3px solid var(--error)", color: "var(--error)" }}>
          ⚠ {error}
        </div>
      )}

      {!data ? (
        <div className="admin-card" style={{ padding: "1.5rem 1.25rem" }}>
          <div className="empty-state"><strong>{loading ? "Cargando…" : "Sin datos"}</strong></div>
        </div>
      ) : (
        <>
          {/* Commit + build time */}
          <div className="admin-card" style={{ padding: "1.25rem 1.5rem", marginBottom: "1rem" }}>
            <div className="card-header" style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.05rem" }}>🏷 {data.service}</h2>
              <button
                onClick={load}
                disabled={loading}
                style={{ padding: ".35rem .9rem", fontSize: ".82rem", background: "var(--bg-elev)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "4px", cursor: loading ? "wait" : "pointer" }}
              >
                {loading ? "…" : "↻ Refrescar"}
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
              <div>
                <div style={{ fontSize: ".72rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".35rem" }}>
                  Git commit
                </div>
                {data.git_commit === "unknown" ? (
                  <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "1.25rem", color: "var(--text-muted)" }}>
                    unknown
                  </div>
                ) : (
                  <a
                    href={`${GITHUB_BASE}${data.git_commit}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "1.25rem", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
                  >
                    {data.git_commit_short}
                  </a>
                )}
                <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: ".72rem", color: "var(--text-faint)", marginTop: ".25rem", wordBreak: "break-all" }}>
                  {data.git_commit}
                </div>
              </div>
              <div>
                <div style={{ fontSize: ".72rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".35rem" }}>
                  Build time
                </div>
                <div style={{ fontSize: "1.15rem", fontWeight: 500 }}>{fmtBuild(data.build_time)}</div>
                <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginTop: ".25rem" }}>{fmtAge(data.build_time)}</div>
              </div>
            </div>
          </div>

          {/* Runtime versions */}
          <div className="admin-card" style={{ padding: "1.25rem 1.5rem" }}>
            <div className="card-header" style={{ marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.05rem" }}>⚙ Runtime</h2>
            </div>
            <table className="data-table">
              <tbody>
                <tr>
                  <td className="muted" style={{ width: "160px" }}>Python</td>
                  <td style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>{data.runtime.python}</td>
                </tr>
                <tr>
                  <td className="muted">Postgres</td>
                  <td style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>{data.runtime.postgres}</td>
                </tr>
                <tr>
                  <td className="muted">Redis</td>
                  <td style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>{data.runtime.redis}</td>
                </tr>
                <tr>
                  <td className="muted">Plataforma</td>
                  <td style={{ fontFamily: "var(--font-mono, monospace)", fontSize: ".85rem", color: "var(--text-muted)" }}>{data.runtime.platform}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ fontSize: ".75rem", color: "var(--text-faint)", marginTop: "1rem" }}>
              ⓘ Endpoint público (sin auth) — útil para health checks externos y debugging cross-team. Reportado por `/api/system/version`.
            </div>
          </div>
        </>
      )}
    </>
  );
}
