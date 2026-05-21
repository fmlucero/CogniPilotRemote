"use client";

// HU-34 — Banner fijo cuando el usuario actual es resultado de impersonación.
// Se muestra arriba del topbar. Click en "Volver a mi cuenta" llama
// POST /api/auth/stop-impersonating y redirige al dashboard del admin.

import { useEffect, useState } from "react";

interface Props {
  /** Nombre/email del usuario que el admin está enmascarando (visible). */
  targetLabel: string;
}

export default function ImpersonationBanner({ targetLabel }: Props) {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);

  // Enriquece con el email del admin original (lo devuelve /api/auth/me).
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.impersonating?.adminEmail) setAdminEmail(d.impersonating.adminEmail);
      })
      .catch(() => { /* no romper si /me falla */ });
    return () => { alive = false; };
  }, []);

  async function handleStop() {
    if (stopping) return;
    setStopping(true);
    try {
      const res = await fetch("/api/auth/stop-impersonating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      // El back ya restauró cookies cp_at/cp_rt del admin. Vamos al dashboard.
      window.location.href = "/dashboard";
    } catch (err) {
      setStopping(false);
      alert("No se pudo volver a tu cuenta: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  return (
    <div
      style={{
        background: "var(--accent)",
        color: "#000",
        padding: ".55rem 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        fontSize: ".88rem",
        fontWeight: 500,
        borderBottom: "2px solid #d4ba3c",
      }}
    >
      <div>
        🎭 <strong>Estás viendo el sistema como {targetLabel}.</strong>
        {adminEmail && <span style={{ opacity: 0.8, marginLeft: ".5rem" }}>(impersonado por {adminEmail})</span>}
      </div>
      <button
        onClick={handleStop}
        disabled={stopping}
        style={{
          padding: ".3rem .9rem",
          background: "#000",
          color: "var(--accent)",
          border: "1px solid #000",
          borderRadius: "4px",
          cursor: stopping ? "wait" : "pointer",
          fontFamily: "inherit",
          fontSize: ".85rem",
          fontWeight: 600,
        }}
      >
        {stopping ? "Saliendo…" : "← Volver a mi cuenta"}
      </button>
    </div>
  );
}
