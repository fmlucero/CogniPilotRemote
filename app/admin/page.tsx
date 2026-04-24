import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/session";
import { getSchedule } from "@/lib/kv";

export default async function AdminPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const schedule = await getSchedule();

  const lastUpdate = schedule?.updatedAt
    ? new Date(schedule.updatedAt).toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Argentina/Buenos_Aires",
      })
    : null;

  return (
    <main className="admin-root">
      <header className="admin-header">
        <div className="admin-header-brand">
          <span>🚚</span>
          <span>CogniPilot Admin</span>
        </div>
        <div className="admin-header-meta">
          <span className="user-badge">👤 {user.username}</span>
          <button id="logout-btn" className="btn-ghost">Salir</button>
        </div>
      </header>

      <div className="admin-container">
        <div className="admin-card">
          <div className="card-header">
            <h2>⏰ Horario permitido</h2>
            {lastUpdate && (
              <p className="last-update">
                Última actualización: <strong>{lastUpdate}</strong>
                {schedule?.updatedBy && <> por <strong>{schedule.updatedBy}</strong></>}
              </p>
            )}
          </div>

          <div id="save-feedback" className="feedback hidden" role="alert"></div>

          <form id="schedule-form" className="schedule-form">
            <div className="toggle-row">
              <label className="toggle-label" htmlFor="enabled-toggle">
                <span>Restricción horaria activa</span>
                <div className="toggle-wrapper">
                  <input
                    id="enabled-toggle"
                    type="checkbox"
                    role="switch"
                    defaultChecked={schedule?.enabled ?? false}
                  />
                  <span className="toggle-track">
                    <span className="toggle-thumb" />
                  </span>
                </div>
              </label>
            </div>

            <div id="time-fields" className="time-fields" style={{ display: schedule?.enabled ? "grid" : "none" }}>
              <div className="field-group">
                <label htmlFor="from-input">Desde</label>
                <input
                  id="from-input"
                  type="time"
                  defaultValue={schedule?.from ?? "08:00"}
                  required
                />
              </div>
              <div className="field-group">
                <label htmlFor="to-input">Hasta</label>
                <input
                  id="to-input"
                  type="time"
                  defaultValue={schedule?.to ?? "18:00"}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="tz-select">Zona horaria</label>
              <select id="tz-select" defaultValue={schedule?.tz ?? "America/Argentina/Buenos_Aires"}>
                <option value="America/Argentina/Buenos_Aires">Argentina (ART, UTC-3)</option>
                <option value="America/Sao_Paulo">Brasil - São Paulo (BRT, UTC-3)</option>
                <option value="America/Santiago">Chile (CLT, UTC-4/-3)</option>
                <option value="America/Bogota">Colombia (COT, UTC-5)</option>
                <option value="America/Lima">Perú (PET, UTC-5)</option>
                <option value="America/Mexico_City">México (CST/CDT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            <div className="action-row">
              <button id="save-btn" type="submit" className="btn-primary">
                💾 Guardar y notificar
              </button>
              <button id="test-btn" type="button" className="btn-secondary">
                📲 Probar push
              </button>
            </div>
          </form>
        </div>

        <div className="admin-card info-card">
          <h3>📡 Estado del sistema</h3>
          <ul className="status-list">
            <li><span className="dot green" /> App Android suscripta al topic <code>schedule-updates</code></li>
            <li><span className="dot green" /> Firebase Cloud Messaging activo</li>
            <li><span className="dot green" /> Backend Vercel operativo</li>
          </ul>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{
        __html: `
          // Toggle visibility of time fields
          const toggle = document.getElementById('enabled-toggle');
          const timeFields = document.getElementById('time-fields');
          toggle.addEventListener('change', () => {
            timeFields.style.display = toggle.checked ? 'grid' : 'none';
          });

          // Logout
          document.getElementById('logout-btn').addEventListener('click', async () => {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login';
          });

          async function postSchedule(feedbackMsg) {
            const btn = document.getElementById('save-btn');
            const testBtn = document.getElementById('test-btn');
            const feedback = document.getElementById('save-feedback');
            btn.disabled = true;
            testBtn.disabled = true;
            feedback.className = 'feedback hidden';

            const payload = {
              enabled: toggle.checked,
              from: document.getElementById('from-input').value || '00:00',
              to: document.getElementById('to-input').value || '00:00',
              tz: document.getElementById('tz-select').value,
            };

            try {
              const res = await fetch('/api/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              const data = await res.json();

              if (res.status === 401) {
                window.location.href = '/login';
                return;
              }

              if (data.fcmError) {
                feedback.textContent = '⚠️ Guardado en KV pero el push falló: ' + data.fcmError;
                feedback.className = 'feedback warning';
              } else {
                feedback.textContent = '✅ ' + (feedbackMsg || 'Horario guardado y push enviado correctamente');
                feedback.className = 'feedback success';
              }
            } catch (err) {
              feedback.textContent = '❌ Error de red: ' + err.message;
              feedback.className = 'feedback error';
            } finally {
              btn.disabled = false;
              testBtn.disabled = false;
              setTimeout(() => { feedback.className = 'feedback hidden'; }, 6000);
            }
          }

          document.getElementById('schedule-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await postSchedule('Horario guardado y push enviado correctamente');
          });

          document.getElementById('test-btn').addEventListener('click', async () => {
            await postSchedule('Push de prueba enviado al dispositivo');
          });
        `
      }} />
    </main>
  );
}
