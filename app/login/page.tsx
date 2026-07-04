import Link from "next/link";

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="CogniPilot"
            className="login-logo-img"
          />
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
            <Link href="/recuperar" style={{ color: "var(--accent)", textDecoration: "none" }}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
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
        `,
        }}
      />
    </main>
  );
}
