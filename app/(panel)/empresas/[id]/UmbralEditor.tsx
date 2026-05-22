"use client";

// HU-12 — Editor del umbralErroresJornada de la empresa (admin only).
// El detalle de empresa es server component; este componente cliente
// fetcha /api/empresas/{id} (que ya incluye el campo) y postea PATCH.

import { useEffect, useState } from "react";

export default function UmbralEditor({ empresaId }: { empresaId: string }) {
  const [valor, setValor] = useState<number | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/empresas/${empresaId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data: { empresa: { umbralErroresJornada?: number } } = await res.json();
        const u = data.empresa.umbralErroresJornada ?? 3;
        if (alive) {
          setValor(u);
          setDraft(String(u));
        }
      } catch {
        // ignore
      }
    })();
    return () => { alive = false; };
  }, [empresaId]);

  async function save() {
    const n = Number(draft);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      setMsg("Debe ser entero entre 1 y 99");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/empresas/${empresaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ umbralErroresJornada: n }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      setValor(n);
      setMsg("✅ Guardado");
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (valor === null) return null;

  const dirty = String(valor) !== draft;

  return (
    <div className="admin-card" style={{ padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
      <div className="card-header" style={{ marginBottom: ".5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>🚨 Umbral de alertas (HU-12)</h2>
      </div>
      <p style={{ fontSize: ".85rem", color: "var(--text-muted)", marginBottom: ".75rem" }}>
        Cantidad de "errores bloqueados" por repartidor en la jornada antes de disparar una alerta.
        Cuentan los eventos <strong>scan_detected</strong> y <strong>user_continued</strong>.
      </p>
      <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
          <span style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Umbral:</span>
          <input
            type="number"
            min={1}
            max={99}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{ width: "5rem", padding: ".4rem .5rem", background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text)" }}
          />
        </label>
        <button
          onClick={save}
          disabled={!dirty || saving}
          style={{
            padding: ".4rem .9rem",
            background: dirty ? "var(--accent)" : "transparent",
            color: dirty ? "#000" : "var(--text-muted)",
            border: dirty ? "none" : "1px solid var(--border)",
            borderRadius: "4px",
            cursor: dirty ? "pointer" : "not-allowed",
            fontWeight: 600,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        {msg && <span style={{ fontSize: ".82rem", color: msg.startsWith("✅") ? "var(--success)" : "var(--error)" }}>{msg}</span>}
        <span style={{ marginLeft: "auto", fontSize: ".78rem", color: "var(--text-faint)" }}>
          Actual: {valor} errores
        </span>
      </div>
    </div>
  );
}
