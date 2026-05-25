"use client";

// HU-48 — Estado del worker arq leído de /api/system/worker.
// Auto-refresh 10s. Cards de queue depth/in-progress/heartbeat + lista de
// functions registradas + sección de settings + raw heartbeat.

import Link from "next/link";
import { useEffect, useState } from "react";

interface WorkerFunction {
  name: string;
  module: string | null;
  doc: string | null;
}

interface Heartbeat {
  raw: string;
  parsed: boolean;
  when_str?: string;
  j_complete?: number;
  j_failed?: number;
  j_retried?: number;
  j_ongoing?: number;
  queued?: number;
}

interface Settings {
  functions: WorkerFunction[];
  max_tries: number | null;
  job_timeout: number | null;
  keep_result: number | null;
  health_check_interval: number | null;
}

interface Response {
  alive: boolean;
  queue_depth: number;
  in_progress_count: number;
  result_count: number;
  pending_job_count: number;
  heartbeat: Heartbeat | null;
  settings: Settings;
  redis_keys_arq_total: number;
  health_check_interval_s: number;
  server_time: number;
}

const POLL_MS = 10_000;

function Kpi({ label, value, color = "var(--text)", hint }: { label: string; value: string | number; color?: string; hint?: string }) {
  return (
    <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
      <div style={{ fontSize: ".72rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".25rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 600, lineHeight: 1.1, color }}>{value}</div>
      {hint && <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginTop: ".25rem" }}>{hint}</div>}
    </div>
  );
}

export default function WorkerView() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/system/worker", { cache: "no-store" });
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
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const hb = data?.heartbeat;

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Worker async (arq)</h2>
          <div className="page-subtitle">
            Estado de tareas asíncronas — el worker `cognipilot-back-worker` procesa la cola Redis.
            {data && ` Refresca cada ${POLL_MS / 1000}s`}
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
          <div className="empty-state"><strong>{loading ? "Cargando worker…" : "Sin datos"}</strong></div>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            <Kpi
              label="Worker"
              value={data.alive ? "✅ Alive" : "❌ Down"}
              color={data.alive ? "#5eead4" : "#f87171"}
              hint={hb?.when_str ? `Último heartbeat: ${hb.when_str}` : "sin heartbeat"}
            />
            <Kpi
              label="Queue depth"
              value={data.queue_depth}
              color={data.queue_depth > 10 ? "#fbbf24" : "var(--text)"}
              hint={hb?.queued !== undefined ? `(arq reporta queued=${hb.queued})` : undefined}
            />
            <Kpi
              label="En ejecución"
              value={data.in_progress_count}
              color={data.in_progress_count > 0 ? "#7dd3fc" : "var(--text-muted)"}
              hint={hb?.j_ongoing !== undefined ? `(arq reporta j_ongoing=${hb.j_ongoing})` : undefined}
            />
            <Kpi
              label="Jobs completados"
              value={hb?.j_complete ?? "—"}
              color={(hb?.j_complete ?? 0) > 0 ? "#5eead4" : "var(--text-muted)"}
              hint={`fallidos: ${hb?.j_failed ?? "—"} · reintentados: ${hb?.j_retried ?? "—"}`}
            />
            <Kpi
              label="Resultados en cache"
              value={data.result_count}
              color="var(--text-muted)"
              hint={`TTL ${data.settings.keep_result ?? "?"}s`}
            />
          </div>

          {/* Settings + functions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
              <div className="card-header" style={{ marginBottom: ".75rem" }}>
                <h2 style={{ fontSize: "1.05rem" }}>⚙ Configuración</h2>
              </div>
              <table className="data-table">
                <tbody>
                  <tr><td className="muted">max_tries</td><td><strong>{data.settings.max_tries ?? "—"}</strong></td></tr>
                  <tr><td className="muted">job_timeout</td><td><strong>{data.settings.job_timeout ?? "—"}s</strong></td></tr>
                  <tr><td className="muted">keep_result</td><td><strong>{data.settings.keep_result ?? "—"}s</strong></td></tr>
                  <tr><td className="muted">health_check_interval</td><td><strong>{data.settings.health_check_interval ?? "—"}s</strong></td></tr>
                </tbody>
              </table>
            </div>

            <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
              <div className="card-header" style={{ marginBottom: ".75rem" }}>
                <h2 style={{ fontSize: "1.05rem" }}>🔧 Functions registradas ({data.settings.functions.length})</h2>
              </div>
              {data.settings.functions.length === 0 ? (
                <div className="empty-state"><strong>Sin functions registradas</strong></div>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {data.settings.functions.map((f) => (
                    <li key={f.name} style={{ padding: ".5rem 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>{f.name}</div>
                      <div style={{ fontSize: ".75rem", color: "var(--text-faint)", fontFamily: "var(--font-mono, monospace)" }}>{f.module}</div>
                      {f.doc && <div style={{ fontSize: ".82rem", color: "var(--text-muted)", marginTop: ".25rem" }}>{f.doc}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Heartbeat raw + estado Redis */}
          <div className="admin-card" style={{ padding: "1rem 1.25rem" }}>
            <div className="card-header" style={{ marginBottom: ".75rem" }}>
              <h2 style={{ fontSize: "1.05rem" }}>💓 Heartbeat + Redis</h2>
            </div>
            {hb ? (
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: ".82rem", color: "var(--text-muted)", padding: ".75rem 1rem", background: "var(--bg-elev)", borderRadius: "4px", marginBottom: ".75rem", wordBreak: "break-all" }}>
                {hb.raw}
              </div>
            ) : (
              <div className="empty-state"><strong>Sin heartbeat — worker no responde</strong></div>
            )}
            <div style={{ fontSize: ".82rem", color: "var(--text-muted)", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              <span>Keys arq:* en Redis: <strong>{data.redis_keys_arq_total}</strong></span>
              <span>Jobs pendientes (arq:job:*): <strong>{data.pending_job_count}</strong></span>
              <span>Resultados (arq:result:*): <strong>{data.result_count}</strong></span>
            </div>
            <div style={{ fontSize: ".78rem", color: "var(--text-faint)", marginTop: ".75rem" }}>
              ⓘ Los resultados se serializan con pickle y no se desensamblan acá por seguridad. Para inspeccionar un job específico usar `docker exec cognipilot-redis redis-cli LRANGE arq:result:* 0 -1`.
            </div>
          </div>
        </>
      )}
    </>
  );
}
