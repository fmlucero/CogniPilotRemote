export default function LoginPage() {
  return (
    <main className="login-root">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-icon">🚚</span>
          <h1>CogniPilot</h1>
          <p>Panel de supervisión</p>
        </div>

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
        </form>
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
                window.location.href = '/admin';
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
        `,
        }}
      />
    </main>
  );
}
