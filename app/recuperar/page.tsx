// HU-25 — Página dedicada de "Olvidaste tu contraseña". Standalone (fuera
// del panel), reusa el estilo de /login. Pública: el proxy la deja pasar
// sin auth.

import Link from "next/link";

export const dynamic = "force-dynamic";

export default function RecuperarPage() {
  return (
    <main className="login-root">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-icon">🔑</span>
          <h1>Recuperar acceso</h1>
          <p>Solicitá un reset de tu contraseña</p>
        </div>

        <p style={{ fontSize: ".88rem", color: "var(--text-muted)", marginBottom: "1rem", lineHeight: 1.5 }}>
          Ingresá tu email. Un administrador va a contactarte por canal seguro para entregarte una contraseña nueva.
        </p>

        <form id="recover-form" className="login-form">
          <div className="field-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="tu@email.com"
            />
          </div>

          <div id="recover-feedback" className="hidden" role="alert"></div>

          <button id="recover-btn" type="submit" className="btn-primary">
            Solicitar reset
          </button>

          <div style={{ marginTop: "1rem", textAlign: "center", fontSize: ".85rem" }}>
            <Link href="/login" style={{ color: "var(--accent)", textDecoration: "none" }}>
              ← Volver al login
            </Link>
          </div>
        </form>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
          document.getElementById('recover-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('recover-btn');
            const fb = document.getElementById('recover-feedback');
            const emailInput = document.getElementById('email');
            const email = emailInput.value;
            btn.disabled = true;
            btn.textContent = 'Enviando…';
            fb.classList.add('hidden');
            try {
              const res = await fetch('/api/auth/reset-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
              });
              const data = await res.json().catch(() => ({}));
              fb.textContent = data.message || 'Solicitud registrada. Un admin va a contactarte por canal seguro.';
              fb.className = 'feedback success';
              fb.classList.remove('hidden');
              emailInput.value = '';
              btn.disabled = false;
              btn.textContent = 'Solicitar reset';
            } catch (err) {
              fb.textContent = 'Error de red: ' + err.message;
              fb.className = 'feedback error';
              fb.classList.remove('hidden');
              btn.disabled = false;
              btn.textContent = 'Solicitar reset';
            }
          });
        `,
        }}
      />
    </main>
  );
}
