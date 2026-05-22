"use client";

// HU-39 — Forms agrupados por categoría para editar settings globales sin
// redeploy. Cada setting muestra label + descripción + input según tipo;
// los que requieren restart muestran warning.

import { useMemo, useState } from "react";

export type SettingType = "int" | "str" | "bool";

export interface Setting {
  key: string;
  type: SettingType;
  label: string;
  description: string;
  default: number | string | boolean;
  category: string;
  hot_reload: boolean;
  value: number | string | boolean;
}

function castInput(value: string, type: SettingType): number | string | boolean | null {
  if (type === "int") {
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
    return n;
  }
  if (type === "bool") return value === "true";
  return value;
}

export default function ConfiguracionView({ initial }: { initial: Setting[] }) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const s of initial) d[s.key] = String(s.value);
    return d;
  });
  const [settings, setSettings] = useState<Setting[]>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Setting[]>();
    for (const s of settings) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return Array.from(map.entries());
  }, [settings]);

  const dirty = useMemo(() => {
    return settings.some((s) => drafts[s.key] !== String(s.value));
  }, [drafts, settings]);

  async function saveAll() {
    setError(null);
    setMsg(null);
    const values: Record<string, unknown> = {};
    for (const s of settings) {
      const d = drafts[s.key];
      if (d === String(s.value)) continue;
      const casted = castInput(d, s.type);
      if (casted === null) {
        setError(`Valor inválido para ${s.label}`);
        return;
      }
      values[s.key] = casted;
    }
    if (Object.keys(values).length === 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status + ": " + (await res.text()).slice(0, 200));
      const data: { updated: number; changes: Array<{ key: string; new: unknown }> } = await res.json();
      // Optimistic update: aplicar los cambios al estado local.
      setSettings((prev) =>
        prev.map((s) => {
          const ch = data.changes.find((c) => c.key === s.key);
          if (!ch) return s;
          return { ...s, value: ch.new as Setting["value"] };
        })
      );
      setMsg(`✅ ${data.updated} setting${data.updated !== 1 ? "s" : ""} actualizado${data.updated !== 1 ? "s" : ""}`);
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function resetDrafts() {
    const d: Record<string, string> = {};
    for (const s of settings) d[s.key] = String(s.value);
    setDrafts(d);
    setError(null);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Configuración del sistema</h2>
          <div className="page-subtitle">
            Parámetros globales editables sin redeploy. Los settings marcados como "requiere restart" toman efecto al próximo arranque del back.
          </div>
        </div>
      </div>

      {error && (
        <div className="admin-card" style={{ padding: ".75rem 1rem", marginBottom: "1rem", borderLeft: "3px solid var(--error)", color: "var(--error)" }}>
          ⚠ {error}
        </div>
      )}
      {msg && (
        <div className="admin-card" style={{ padding: ".75rem 1rem", marginBottom: "1rem", borderLeft: "3px solid var(--success, #2bb45f)", color: "var(--success, #2bb45f)" }}>
          {msg}
        </div>
      )}

      {grouped.map(([cat, items]) => (
        <div key={cat} className="admin-card" style={{ padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <div className="card-header" style={{ marginBottom: ".75rem" }}>
            <h2 style={{ fontSize: "1.05rem" }}>{cat}</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Setting</th>
                <th style={{ width: "20%" }}>Valor</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const isDirty = drafts[s.key] !== String(s.value);
                return (
                  <tr key={s.key}>
                    <td>
                      <strong>{s.label}</strong>
                      <div style={{ fontSize: ".72rem", color: "var(--text-faint)", fontFamily: "var(--font-mono, monospace)" }}>{s.key}</div>
                      {!s.hot_reload && (
                        <div style={{ fontSize: ".72rem", color: "var(--warning, #d9a04a)", marginTop: ".15rem" }}>
                          ⚠ requiere restart
                        </div>
                      )}
                    </td>
                    <td>
                      {s.type === "bool" ? (
                        <select
                          value={drafts[s.key]}
                          onChange={(e) => setDrafts({ ...drafts, [s.key]: e.target.value })}
                          style={{ padding: ".35rem .5rem", background: "var(--bg-elev)", border: `1px solid ${isDirty ? "var(--accent)" : "var(--border)"}`, borderRadius: "4px", color: "var(--text)" }}
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <input
                          type={s.type === "int" ? "number" : "text"}
                          value={drafts[s.key]}
                          onChange={(e) => setDrafts({ ...drafts, [s.key]: e.target.value })}
                          style={{ width: "100%", padding: ".35rem .5rem", background: "var(--bg-elev)", border: `1px solid ${isDirty ? "var(--accent)" : "var(--border)"}`, borderRadius: "4px", color: "var(--text)" }}
                        />
                      )}
                      <div style={{ fontSize: ".72rem", color: "var(--text-faint)", marginTop: ".15rem" }}>
                        default: {String(s.default)}
                      </div>
                    </td>
                    <td className="muted" style={{ fontSize: ".85rem" }}>{s.description}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
        <button
          onClick={resetDrafts}
          disabled={!dirty || saving}
          style={{
            padding: ".5rem 1rem",
            background: "transparent",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            cursor: dirty && !saving ? "pointer" : "not-allowed",
            opacity: dirty ? 1 : 0.5,
          }}
        >
          Descartar cambios
        </button>
        <button
          onClick={saveAll}
          disabled={!dirty || saving}
          style={{
            padding: ".5rem 1rem",
            background: dirty ? "var(--accent)" : "transparent",
            color: dirty ? "#000" : "var(--text-muted)",
            border: dirty ? "none" : "1px solid var(--border)",
            borderRadius: "4px",
            cursor: dirty && !saving ? "pointer" : "not-allowed",
            fontWeight: 600,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </>
  );
}
