"use client";

// HU-12 — Banner global de alertas no leídas. Poll cada 30s. Se monta en
// (panel)/layout.tsx; solo se renderiza si el usuario tiene scope (admin /
// supervisor / gerente) y hay al menos una alerta sin leer.

import Link from "next/link";
import { useEffect, useState } from "react";

const POLL_MS = 30_000;

interface AlertaRow {
  id: string;
  tipo: string;
  repartidorNombre: string | null;
  payload: { errores_hoy?: number; umbral?: number } | null;
}

interface AlertasResponse {
  alertas: AlertaRow[];
  unreadCount: number;
}

export default function AlertasBanner({ rol }: { rol: string }) {
  const [data, setData] = useState<AlertasResponse | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (rol === "repartidor") return;
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/alertas?soloNoLeidas=true&limit=10", { cache: "no-store" });
        if (!res.ok) return;
        const json: AlertasResponse = await res.json();
        if (alive) setData(json);
      } catch {
        // silent — el banner es no-blocking
      }
    }
    load();
    const t = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [rol]);

  if (rol === "repartidor") return null;
  if (!data || data.unreadCount === 0 || hidden) return null;

  // El primer evento para el preview.
  const first = data.alertas[0];
  const previewName = first?.repartidorNombre ?? "un repartidor";
  const previewErr = first?.payload?.errores_hoy ?? "?";

  return (
    <div
      style={{
        background: "rgba(217, 160, 74, 0.18)",
        borderBottom: "2px solid var(--warning, #d9a04a)",
        padding: ".55rem 1.25rem",
        display: "flex",
        alignItems: "center",
        gap: ".75rem",
        fontSize: ".88rem",
      }}
    >
      <strong style={{ color: "var(--warning, #d9a04a)" }}>🚨 {data.unreadCount} alerta{data.unreadCount !== 1 ? "s" : ""} sin leer</strong>
      {data.unreadCount === 1 && first?.tipo === "umbral_errores" && (
        <span style={{ color: "var(--text-muted)" }}>
          — {previewName} superó el umbral ({previewErr} errores)
        </span>
      )}
      {data.unreadCount > 1 && (
        <span style={{ color: "var(--text-muted)" }}>— última: {previewName}</span>
      )}
      <Link
        href="/alertas"
        style={{
          marginLeft: "auto",
          padding: ".25rem .75rem",
          background: "var(--warning, #d9a04a)",
          color: "#000",
          borderRadius: "4px",
          fontWeight: 600,
          fontSize: ".82rem",
          textDecoration: "none",
        }}
      >
        Ver alertas →
      </Link>
      <button
        onClick={() => setHidden(true)}
        style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem" }}
        title="Ocultar banner (vuelve a aparecer si llegan nuevas)"
        aria-label="Cerrar banner"
      >
        ×
      </button>
    </div>
  );
}
