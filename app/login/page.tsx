export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const { msg } = await searchParams;
  const showUseAppNotice = msg === "use-app";

  return (
    <main className="login-root">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-icon">🚚</span>
          <h1>CogniPilot</h1>
          <p>Panel de supervisión</p>
        </div>

        {showUseAppNotice && (
          <div className="feedback warning" role="alert" style={{ marginBottom: "1rem" }}>
            Los repartidores trabajan desde la app Android. Usá tus credenciales ahí; este panel es para roles de supervisión.
          </div>
        )}

        <form id="login-form" className="login-form">
          <div className="field-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="facu@cognipilot.local"
            />
          </div>
          <div className="field-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </div>

          <div id="login-error" className="login-error hidden" role="alert"></div>

          <button id="login-btn" type="submit" className="btn-primary">
            Entrar
          </button>

          <div style={{ marginTop: "1rem", textAlign: "center", fontSize: ".85rem" }}>
            <a
              href="#"
              id="forgot-link"
              style={{ color: "var(--accent)", textDecoration: "none" }}
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        </form>

        {/* HU-25 — Modal inline para solicitar reset (oculto por default). */}
        <div id="forgot-modal" className="hidden" style={{ marginTop: "1rem" }}>
          <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "1rem 0" }} />
          <p style={{ fontSize: ".88rem", marginBottom: ".5rem" }}>
            Ingresá tu email. Un administrador va a contactarte para resetear tu contraseña.
          </p>
          <form id="forgot-form">
            <div className="field-group">
              <label htmlFor="forgot-email">Email</label>
              <input id="forgot-email" name="email" type="email" required placeholder="tu@email.com" />
            </div>
            <div id="forgot-feedback" className="hidden" role="alert" style={{ marginBottom: ".5rem" }}></div>
            <div style={{ display: "flex", gap: ".5rem" }}>
              <button type="button" id="forgot-cancel" className="btn-secondary" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button id="forgot-submit" type="submit" className="btn-primary" style={{ flex: 1 }}>
                Solicitar
              </button>
            </div>
          </form>
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
          document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('login-btn');
            const errEl = document.getElementById('login-error');
            btn.disabled = true;
            btn.textContent = 'Ingresando…';
            errEl.classList.add('hidden');

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
              const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
              });

              if (res.ok) {
                // El proxy se encargará de mandar a la home-por-rol al pegarle a /.
                window.location.href = '/';
              } else {
                const data = await res.json().catch(() => ({}));
                errEl.textContent = data.error ?? 'Credenciales incorrectas';
                errEl.classList.remove('hidden');
                btn.disabled = false;
                btn.textContent = 'Entrar';
              }
            } catch (err) {
              errEl.textContent = 'Error de red: ' + err.message;
              errEl.classList.remove('hidden');
              btn.disabled = false;
              btn.textContent = 'Entrar';
            }
          });

          // HU-25 — Toggle del modal de reset
          document.getElementById('forgot-link').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('forgot-modal').classList.toggle('hidden');
          });
          document.getElementById('forgot-cancel').addEventListener('click', () => {
            document.getElementById('forgot-modal').classList.add('hidden');
          });
          document.getElementById('forgot-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('forgot-submit');
            const fb = document.getElementById('forgot-feedback');
            const email = document.getElementById('forgot-email').value;
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
              fb.textContent = data.message || 'Solicitud registrada. Un admin va a contactarte.';
              fb.className = 'feedback success';
              fb.classList.remove('hidden');
              document.getElementById('forgot-email').value = '';
            } catch (err) {
              fb.textContent = 'Error de red: ' + err.message;
              fb.className = 'feedback error';
              fb.classList.remove('hidden');
            } finally {
              btn.disabled = false;
              btn.textContent = 'Solicitar';
            }
          });
        `,
        }}
      />
    </main>
  );
}
