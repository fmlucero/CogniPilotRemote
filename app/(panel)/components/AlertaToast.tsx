"use client";

// HU-40 — Toasts push de alertas en tiempo real para admin/supervisor/gerente.
// Conecta a /api/realtime/stream (SSE) y escucha el evento "alerta_nueva".
// El back ya hace el filtro de scope antes de emitir (admin global,
// supervisor/gerente su empresa). Si la conexión cae, el navegador
// reconecta automáticamente (default del EventSource).

import Link from "next/link";
import { useEffect, useState } from "react";

const AUTO_DISMISS_MS = 10_000;
const MAX_VISIBLE = 4;

interface AlertaPayload {
  alerta_id: string;
  tipo: string;
  empresa_id?: string;
  repartidor_id?: string;
  repartidor_nombre?: string;
  repartidor_email?: string;
  errores_hoy?: number;
  umbral?: number;
  // HU-15 — campos solo en alertas tipo anomalia_estadistica
  mean?: number;
  stddev?: number;
  threshold?: number;
  jornadas_consideradas?: number;
  lat?: number | null;
  lng?: number | null;
  ts?: number;
}

interface ToastItem {
  id: string;
  payload: AlertaPayload;
  arrivedAt: number;
}

export default function AlertaToast({ rol }: { rol: string }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    if (rol === "repartidor") return;

    const es = new EventSource("/api/realtime/stream", { withCredentials: true });

    function handleAlerta(ev: MessageEvent) {
      try {
        const data: AlertaPayload = JSON.parse(ev.data);
        // Dedup por alerta_id — el server puede reemitir; el toast debe ser único.
        setItems((prev) => {
          if (prev.some((t) => t.payload.alerta_id === data.alerta_id)) return prev;
          const next: ToastItem = { id: data.alerta_id, payload: data, arrivedAt: Date.now() };
          // Stack: más recientes arriba, cap a MAX_VISIBLE
          return [next, ...prev].slice(0, MAX_VISIBLE);
        });
      } catch {
        // payload malformado — ignoramos
      }
    }

    es.addEventListener("alerta_nueva", handleAlerta as EventListener);

    return () => {
      es.removeEventListener("alerta_nueva", handleAlerta as EventListener);
      es.close();
    };
  }, [rol]);

  // Auto-dismiss tras AUTO_DISMISS_MS desde que cada toast apareció.
  useEffect(() => {
    if (items.length === 0) return;
    const timers = items.map((t) => {
      const remaining = Math.max(0, AUTO_DISMISS_MS - (Date.now() - t.arrivedAt));
      return setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, remaining);
    });
    return () => timers.forEach(clearTimeout);
  }, [items]);

  if (rol === "repartidor" || items.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "1rem",
        right: "1rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: ".5rem",
        maxWidth: "22rem",
        pointerEvents: "none",
      }}
    >
      {items.map((t) => {
        const p = t.payload;
        let headline: string;
        let detail: string | null = null;
        if (p.tipo === "umbral_errores") {
          headline = `🚨 ${p.repartidor_nombre ?? "Repartidor"} superó el umbral`;
          if (p.errores_hoy !== undefined) detail = `${p.errores_hoy} errores (umbral: ${p.umbral})`;
        } else if (p.tipo === "anomalia_estadistica") {
          headline = `📈 Anomalía: ${p.repartidor_nombre ?? "Repartidor"}`;
          if (p.errores_hoy !== undefined && p.mean !== undefined) {
            detail = `${p.errores_hoy} errores hoy vs media ${p.mean}±${p.stddev} (${p.jornadas_consideradas} jornadas)`;
          }
        } else {
          headline = `🚨 Alerta: ${p.tipo}`;
        }
        return (
          <div
            key={t.id}
            style={{
              background: "var(--bg-elev, #1f1f2a)",
              border: "1px solid var(--warning, #d9a04a)",
              borderLeft: "4px solid var(--warning, #d9a04a)",
              borderRadius: "6px",
              padding: ".75rem 1rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              pointerEvents: "auto",
              animation: "alerta-toast-in .25s ease-out",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: ".5rem" }}>
              <strong style={{ fontSize: ".88rem", color: "var(--warning, #d9a04a)" }}>{headline}</strong>
              <button
                onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: 0 }}
                aria-label="Cerrar toast"
              >×</button>
            </div>
            {detail && (
              <div style={{ fontSize: ".82rem", color: "var(--text-muted)", marginTop: ".25rem" }}>
                {detail}
              </div>
            )}
            {p.repartidor_email && (
              <div style={{ fontSize: ".75rem", color: "var(--text-faint)", marginTop: ".15rem" }}>
                {p.repartidor_email}
              </div>
            )}
            <div style={{ display: "flex", gap: ".75rem", marginTop: ".5rem", fontSize: ".82rem" }}>
              <Link
                href="/alertas"
                style={{ color: "var(--accent)", textDecoration: "none" }}
              >
                Ver en /alertas →
              </Link>
              {p.repartidor_id && (
                <Link
                  href={`/usuarios/${p.repartidor_id}`}
                  style={{ color: "var(--text-muted)", textDecoration: "none" }}
                >
                  Repartidor ↗
                </Link>
              )}
              {p.lat != null && p.lng != null && (
                <a
                  href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--text-muted)", textDecoration: "none" }}
                >
                  Ubicación ↗
                </a>
              )}
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes alerta-toast-in {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
