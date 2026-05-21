"use client";

import { useState } from "react";

interface FormState {
  current: string;
  next: string;
  confirm: string;
}

const emptyForm: FormState = { current: "", next: "", confirm: "" };

export default function PerfilForm() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error" | "warning"; text: string } | null>(null);

  function flash(kind: "success" | "error" | "warning", text: string) {
    setFeedback({ kind, text });
    setTimeout(() => setFeedback(null), 6000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (form.next.length < 8) {
      flash("warning", "La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (form.next !== form.confirm) {
      flash("warning", "La confirmación no coincide");
      return;
    }
    if (form.next === form.current) {
      flash("warning", "La nueva contraseña debe ser distinta de la actual");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      if (res.status === 204) {
        flash("success", "Contraseña actualizada correctamente. La próxima vez que ingreses, usá la nueva.");
        setForm(emptyForm);
        return;
      }
      const data = await res.json().catch(() => ({} as { detail?: string; error?: string }));
      const msg = data.detail ?? data.error ?? `HTTP ${res.status}`;
      flash("error", msg);
    } catch (err) {
      flash("error", "Error de red: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {feedback && (
        <div className={`feedback ${feedback.kind}`} role="alert" style={{ marginBottom: "1rem" }}>
          {feedback.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-grid" autoComplete="off">
        <div className="field-group field-full">
          <label htmlFor="cur-pass">Contraseña actual</label>
          <input
            id="cur-pass"
            type="password"
            autoComplete="current-password"
            required
            value={form.current}
            onChange={(e) => setForm({ ...form, current: e.target.value })}
          />
        </div>
        <div className="field-group">
          <label htmlFor="new-pass">Contraseña nueva</label>
          <input
            id="new-pass"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })}
            placeholder="Mínimo 8 caracteres"
          />
        </div>
        <div className="field-group">
          <label htmlFor="conf-pass">Repetir nueva contraseña</label>
          <input
            id="conf-pass"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </div>
        <div className="field-full action-row">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Guardando…" : "🔐 Cambiar contraseña"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => { setForm(emptyForm); setFeedback(null); }}
            disabled={submitting}
          >
            Limpiar
          </button>
        </div>
      </form>
    </>
  );
}
