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

        <div className="admin-card live-card">
          <div className="card-header live-header">
            <h2>📊 Actividad en vivo</h2>
            <span id="live-status" className="live-status">
              <span className="dot pulse" /> escuchando…
            </span>
          </div>

          <div id="alert-banner" className="alert-banner hidden" role="alert">
            <div className="alert-banner-icon">🚨</div>
            <div className="alert-banner-body">
              <strong id="alert-title">Escaneo detectado fuera de horario</strong>
              <span id="alert-subtitle" className="alert-subtitle">—</span>
            </div>
          </div>

          <div className="counters">
            <div className="counter">
              <span className="counter-label">Aperturas</span>
              <span id="cnt-app_opened" className="counter-value">0</span>
            </div>
            <div className="counter">
              <span className="counter-label">Cartel rojo</span>
              <span id="cnt-scan_detected" className="counter-value">0</span>
            </div>
            <div className="counter counter-danger">
              <span className="counter-label">Continuó igual</span>
              <span id="cnt-user_continued" className="counter-value">0</span>
            </div>
            <div className="counter counter-success">
              <span className="counter-label">Canceló</span>
              <span id="cnt-user_cancelled" className="counter-value">0</span>
            </div>
          </div>

          <ul id="event-feed" className="event-feed">
            <li className="event-empty">Esperando eventos del dispositivo…</li>
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

          // ─── Live activity feed ──────────────────────────────────────────
          (function liveFeed() {
            const feed = document.getElementById('event-feed');
            const banner = document.getElementById('alert-banner');
            const alertTitle = document.getElementById('alert-title');
            const alertSubtitle = document.getElementById('alert-subtitle');
            const liveStatus = document.getElementById('live-status');
            const SCAN_ALERT_WINDOW_MS = 30_000;
            const FEED_LIMIT = 30;
            const POLL_INTERVAL_MS = 1500;

            const counters = {
              app_opened: 0,
              scan_detected: 0,
              user_continued: 0,
              user_cancelled: 0,
            };

            const eventBuffer = [];
            let lastSeen = 0;

            const labels = {
              app_opened: { icon: '🚚', text: 'App abierta', cls: 'ev-info' },
              warning_shown: { icon: '🟠', text: 'Cartel naranja', cls: 'ev-warn' },
              scan_detected: { icon: '🚫', text: 'Cartel rojo (escaneo detectado)', cls: 'ev-danger' },
              user_continued: { icon: '⚠️', text: 'Usuario continuó igual', cls: 'ev-danger' },
              user_cancelled: { icon: '✅', text: 'Usuario canceló', cls: 'ev-success' },
            };

            function fmtTime(ms) {
              const d = new Date(ms);
              return d.toLocaleTimeString('es-AR', { hour12: false });
            }

            function ago(ms) {
              const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
              if (s < 60) return s + 's';
              if (s < 3600) return Math.floor(s / 60) + 'm';
              return Math.floor(s / 3600) + 'h';
            }

            function refreshBanner() {
              const lastScan = [...eventBuffer].reverse().find((e) => e.type === 'scan_detected');
              if (!lastScan) {
                banner.className = 'alert-banner hidden';
                return;
              }
              const elapsed = Date.now() - lastScan.timestamp;
              if (elapsed > SCAN_ALERT_WINDOW_MS) {
                banner.className = 'alert-banner hidden';
                return;
              }
              const inSched = lastScan.inSchedule === false ? 'fuera de horario' : (lastScan.inSchedule === true ? 'dentro de horario' : '');
              alertTitle.textContent = '🚨 Cartel rojo activo en el dispositivo';
              alertSubtitle.textContent = (inSched ? inSched + ' · ' : '') + 'hace ' + ago(lastScan.timestamp);
              banner.className = 'alert-banner';
            }

            function refreshCounters() {
              for (const k of Object.keys(counters)) {
                const el = document.getElementById('cnt-' + k);
                if (el) el.textContent = counters[k];
              }
            }

            function renderFeed() {
              if (eventBuffer.length === 0) {
                feed.innerHTML = '<li class="event-empty">Esperando eventos del dispositivo…</li>';
                return;
              }
              const recent = eventBuffer.slice(-FEED_LIMIT).reverse();
              feed.innerHTML = recent.map((e) => {
                const meta = labels[e.type] || { icon: '•', text: e.type, cls: '' };
                const detail = [];
                if (e.screenName) detail.push(e.screenName);
                if (e.keywords && e.keywords.length) detail.push(e.keywords.join(', '));
                if (typeof e.inSchedule === 'boolean') detail.push(e.inSchedule ? 'en horario' : 'fuera de horario');
                const detailHtml = detail.length ? '<span class="event-meta">' + detail.join(' · ') + '</span>' : '';
                return '<li class="event-row ' + meta.cls + '">'
                  + '<span class="event-icon">' + meta.icon + '</span>'
                  + '<div class="event-body">'
                    + '<span class="event-title">' + meta.text + '</span>'
                    + detailHtml
                  + '</div>'
                  + '<span class="event-time">' + fmtTime(e.timestamp) + '</span>'
                + '</li>';
              }).join('');
            }

            function ingest(events) {
              if (!events || !events.length) return;
              for (const e of events) {
                eventBuffer.push(e);
                if (counters[e.type] !== undefined) counters[e.type]++;
                if (e.timestamp > lastSeen) lastSeen = e.timestamp;
              }
              if (eventBuffer.length > 200) eventBuffer.splice(0, eventBuffer.length - 200);
              renderFeed();
              refreshCounters();
              refreshBanner();
            }

            async function poll() {
              try {
                const url = lastSeen ? '/api/events?since=' + lastSeen : '/api/events';
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                if (!lastSeen && Array.isArray(data.events)) {
                  // Primer poll: tomar todo
                  ingest(data.events);
                } else {
                  ingest(data.events || []);
                }
                liveStatus.classList.remove('error');
              } catch (err) {
                liveStatus.classList.add('error');
                console.warn('live poll error', err);
              }
            }

            // Refresh banner timer aparte: el tiempo corre aunque no lleguen eventos
            setInterval(refreshBanner, 1000);
            poll();
            setInterval(poll, POLL_INTERVAL_MS);
          })();
        `
      }} />
    </main>
  );
}
