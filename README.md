# CogniPilot Remote (Front Web)

Panel administrativo de CogniPilot — **Next.js 16 + React 19**. Server Components consumen el back FastAPI por HTTP con cookie forwarding. **Solo UI** (no maneja DB ni emite tokens; los endpoints `app/api/*` fueron removidos en el cutover de HU-19/HU-20).

> Backend: [CogniPilotBack](https://github.com/fmlucero/CogniPilotBack) (FastAPI + Postgres + Redis). App móvil: [CogniPilot](https://github.com/fmlucero/CogniPilot) (Android Kotlin).

## Acceso

- **ZeroTier interno**: `http://10.201.0.67` (puerto 80 vía nginx — **NO usar `:3000` directo** porque ese container no tiene `/api/*`)
- **Internet (Cloudflare Tunnel)**: URL efímera del Quick Tunnel — leer la actual con `~/cfurl.sh` en la VM. Rota con cada arranque del systemd service `cloudflared`.

## Stack

| Capa | Tech | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.4 |
| Vista | React + Server Components | 19.2.4 |
| Lenguaje | TypeScript | 5.x |
| Estilos | CSS global (`app/globals.css`) — sin Tailwind | — |
| JWT verify (proxy + Server Components) | jsonwebtoken | 9.0.x |
| Charts | SVG nativo (path + linearGradient) — sin recharts/tremor | — |
| Mapa | Leaflet 1.9.4 (CDN dinámico) + tiles CARTO dark | — |
| Lint | eslint-config-next | 16.2.4 |

**Decisión consciente**: cero deps de UI adicionales más allá del stack base. Los charts (HU-21 `/metricas`, HU-14 `/gerente`) son SVG inline; el mapa es Leaflet cargado vía CDN. Es defensible para TIF (cero lock-in con libs propietarias) y evita problemas de SSR con paquetes de React no preparados para Next 16.

> Nota: el repo tiene `AGENTS.md` advirtiendo "this is NOT the Next.js you know" — Next 16 cambió APIs vs versiones anteriores. Consultar `node_modules/next/dist/docs/` antes de cualquier cambio mayor.

## Arquitectura post-cutover

```
   Browser (admin / supervisor / gerente)
        │ HTTPS
        ▼
   Cloudflare Tunnel
        │
        ▼
   nginx :80 (compose de cognipilot-back, con resolver dinámico — I-19)
   ├── /api/realtime/*  → FastAPI :8000 (SSE, proxy_buffering off)
   ├── /api/*           → FastAPI :8000 (back-api)
   ├── /health(/db)?    → FastAPI :8000 (Docker healthcheck)
   └── /                → este front :3000 (cognipilot-app)
                          └── Server Components hacen fetch a BACK_API_URL
                              via lib/api.ts (serverFetch + cookie forwarding)
```

## Estructura

```
cognipilot-remote/
├── app/
│   ├── (panel)/                     ← Layout protegido (auth requerida)
│   │   ├── layout.tsx               ← Sidebar + topbar + ImpersonationBanner (HU-34)
│   │   ├── components/
│   │   │   ├── Sidebar.tsx          ← consume NAV_ITEMS según rol
│   │   │   ├── LogoutButton.tsx
│   │   │   ├── FleetMap.tsx         ← componente Leaflet reusable (HU-11/26)
│   │   │   └── ImpersonationBanner.tsx ← banner global con botón "Volver" (HU-34)
│   │   ├── dashboard/               ← HU-29 feed eventos + HU-11 mapa flota (admin)
│   │   ├── supervisor/              ← HU-26 home dedicada (rol supervisor)
│   │   ├── gerente/                 ← HU-27/14/16 KPIs históricos + export CSV (rol gerente)
│   │   ├── empresas/                ← HU-01 listado + HU-33 [id]/detalle (admin)
│   │   ├── usuarios/                ← HU-02 CRUD + HU-22 [id] detalle + HU-34 botón impersonar
│   │   ├── dispositivos/            ← HU-35 listado + HU-44 columna Ubicación
│   │   ├── incidentes/              ← HU-13 filtros por tipo + HU-37 export CSV
│   │   ├── metricas/                ← HU-21 cards + 3 sparklines SVG (admin)
│   │   ├── sistema/                 ← HU-38 salud del sistema (admin)
│   │   ├── perfil/                  ← HU-24 cambio de password propia
│   │   ├── reglas/                  ← (disabled — espera HU-04)
│   │   └── reportes/                ← (legacy — HU-16 vive en /gerente botón export)
│   ├── login/                       ← /login (no requiere auth)
│   ├── layout.tsx                   ← Root layout (font, html)
│   ├── globals.css                  ← Tema CogniPilot (--accent: #ffe14d, etc.)
│   └── page.tsx                     ← Redirige según rol
├── lib/
│   ├── api.ts                       ← serverFetch() con cookie forwarding al back
│   ├── auth.ts                      ← getAuthUser() para Server Components
│   ├── dal.ts                       ← requireUser/requireRole con cache() de React
│   ├── jwt.ts                       ← verifyAccess (HS256) — AccessPayload con impersonated_by
│   ├── nav.ts                       ← NAV_ITEMS + homeForRole + isAllowed (single source of truth)
│   └── cuit.ts                      ← formatCuitProgressive (HU-01)
├── proxy.ts                         ← Next 16 "middleware" — gating de rutas por rol
├── package.json
└── tsconfig.json
```

## Páginas por rol

| Ruta | admin | supervisor | gerente |
|---|---|---|---|
| `/dashboard` | ✅ (feed + flota completa) | — | — |
| `/supervisor` | — | ✅ (home con KPIs + flota de su empresa) | — |
| `/gerente` | — | — | ✅ (KPIs históricos + export CSV) |
| `/empresas` y `/empresas/[id]` | ✅ | — | — |
| `/usuarios` y `/usuarios/[id]` | ✅ | ✅ (su empresa) | — |
| `/dispositivos` | ✅ | ✅ (su empresa) | — |
| `/incidentes` | ✅ | ✅ (su empresa) | — |
| `/metricas` | ✅ | — | — |
| `/sistema` | ✅ | — | — |
| `/perfil` | ✅ | ✅ | ✅ |

`homeForRole`: repartidor → `/login` (no usa el panel), supervisor → `/supervisor`, gerente → `/gerente`, admin → `/dashboard`.

## Autenticación (cross-stack)

1. Browser → `POST /api/auth/login` (FastAPI valida bcrypt, firma JWT HS256).
2. FastAPI setea cookie httpOnly `cp_at` (access, 15min TTL) y `cp_rt` (refresh, 30d).
3. Browser navega a una ruta `(panel)/*`.
4. `proxy.ts` (Next 16) lee la cookie con `jwt.verify` (mismo `JWT_SECRET` que el back) — redirige a `/login` si falta o `homeForRole(rol)` si no tiene permiso.
5. Server Component hace `serverFetch('/api/...')` → `lib/api.ts` forwarda la cookie al back → back valida y responde JSON.
6. **HU-34 impersonación**: si el JWT tiene `impersonated_by`, `app/(panel)/layout.tsx` monta `<ImpersonationBanner />` con "Volver a mi cuenta" que llama `POST /api/auth/stop-impersonating`.

Resultado: cookie compartida, mismo secret entre back y front. Nadie se desloguea durante un redeploy.

## HUs cubiertas en el front

| HU | Página | Notas |
|---|---|---|
| HU-01 | `/empresas` + `/empresas/[id]` | CRUD + detalle con KPIs (HU-33) |
| HU-02 | `/usuarios` | CRUD + creds one-shot, supervisor solo repartidores de su empresa |
| HU-05 | `/dashboard` | Form de ventana horaria |
| HU-11 | `<FleetMap />` | Markers por repartidor + auto-fit primer load (I-26: fix de zoom reset) |
| HU-13/37 | `/incidentes` | Filtros por rango y tipos + botón "Descargar CSV" |
| HU-14 | `/gerente` | Charts SVG eventos/día + barras por tipo |
| HU-16 | `/gerente` | Botón "Descargar CSV" → `/api/reportes/eventos.csv` |
| HU-19/20 | (cutover) | Front pasa a solo-UI tras la migración a FastAPI |
| HU-21 | `/metricas` | 8 cards + 3 sparklines SVG (RPS, p95, events) |
| HU-22 | `/usuarios/[id]` | Detalle con dispositivos + asignaciones + eventos |
| HU-23 | varios | Pill de connectionState online/active_today/offline |
| HU-24 | `/perfil` | Form de cambio de password propio |
| HU-26 | `/supervisor` | Home dedicada (KPIs + FleetMap + listado) |
| HU-27 | `/gerente` | Home con selector de rango + tabla top users |
| HU-28 | nav | Refactor `/admin/*` → `/` + NAV_ITEMS centralizado |
| HU-29 | feed | Muestra autor (nombre + empresa) en cada evento |
| HU-30 | UI respeta scope | Sin cambio visible, los endpoints filtran por rol |
| HU-33 | `/empresas/[id]` | KPIs + secciones usuarios/rutas/reglas |
| HU-34 | `/usuarios` + banner global | Botón "🎭 Impersonar" sobre supervisor/gerente |
| HU-35 | `/dispositivos` | Tabla + filtros conexión/activo + búsqueda |
| HU-38 | `/sistema` | Cards de containers + KPIs + auto-refresh 15s |
| HU-44 | `/dispositivos`, `/usuarios/[id]` | Columna "Ubicación" con link a Google Maps |

## Lo que NO está acá (vive en cognipilot-back)

- ~~Prisma~~ — Alembic owns el schema
- ~~`app/api/*`~~ — route handlers borrados, nginx rutea a FastAPI
- ~~firebase-admin~~ — sin FCM; polling + SSE propio (HU-18)
- ~~lib/{prisma,firebase-admin,password}.ts~~ — borrados
- ~~Seed~~ — movido a `cognipilot-back/scripts/seed.py`

## Variables de entorno

`.env.example` con las dos críticas:

- `JWT_SECRET`: **mismo** que `cognipilot-back` para que la cookie `cp_at` valide cross-stack.
- `BACK_API_URL`: `http://host.docker.internal:8001` (modo paralelo en la VM) o `http://back-api:8000` (modo bundled, post-cutover total al compose del back).

## Desarrollo local

```powershell
cp .env.example .env.local
# Editar .env.local con JWT_SECRET (mismo del back) y BACK_API_URL=http://10.201.0.67:8001
npm install
npm run dev         # → http://localhost:3000
```

> **Reminder operativo**: el front no se corre local para QA del proyecto — todo va a la VM UM-Cloud. Ver `COGNIPILOT_STATUS.md` §1 para infra.

## Deploy en la VM

```bash
ssh -i F:\Proys\cognipilot-um.pem ubuntu@10.201.0.67
cd ~/cognipilot
git pull
docker compose up -d --build app
```

El nginx del compose del back ya rutea `/` a este container `cognipilot-app:3000`.

## Credenciales de prueba

```
Admin:        facu@cognipilot.local                / admin123
Supervisor:   supervisor@logisticacuyo.com.ar      / super123
Gerente:      gerente@logisticacuyo.com.ar         / gerente123
Repartidor:   (no usan el panel web — van por la app Android)
```

## URLs

| Recurso | URL |
|---|---|
| Panel via ZeroTier | http://10.201.0.67 |
| Panel via Internet | URL del Cloudflare Tunnel — `ssh ubuntu@10.201.0.67 '~/cfurl.sh'` |
| OpenAPI del back | http://10.201.0.67/docs |
