# CogniPilot Front (Next.js admin UI)

Next.js 16 + React 19 — **SOLO UI** post-cutover. Todo lo que sea API/DB/auth/
notif vive en [cognipilot-back](https://github.com/fmlucero/CogniPilotBack)
(FastAPI). El front consume el back vía Server Components con `serverFetch()`.

Corre en docker-compose dentro de la VM `Docker-Cognipilot` (UM-Cloud) y se
accede vía:

- **ZeroTier interno**: `http://10.201.0.67` (puerto 80 vía nginx — **NO usar
  `:3000` directo** porque ese container no tiene `/api/*`)
- **Internet (Cloudflare Tunnel)**: URL efímera del Quick Tunnel — leer la
  actual con `~/cfurl.sh` en la VM. Rota con cada arranque del systemd service
  `cloudflared`.

## Arquitectura post-cutover

```
   Browser (admin)
        │ HTTPS
        ▼
   Cloudflare Tunnel
        │
        ▼
   nginx :80 (cognipilot-back)
   ├── /api/realtime/*  → FastAPI :8000 (SSE, proxy_buffering off)
   ├── /api/*           → FastAPI :8000 (cognipilot-back-api)
   └── /                → este front :3000 (cognipilot-app)
                          └── Server Components hacen fetch a BACK_API_URL
                              via lib/api.ts (serverFetch + cookie forwarding)
```

## Stack

- **Next.js 16.2.4 / React 19** — App Router con Server Components
- **jsonwebtoken** — verify-only de la cookie `cp_at` (firmada por FastAPI)
- **Postgres 16-alpine** + **pgAdmin** — siguen en el `docker-compose.yml` de
  este repo (los heredamos del cutover), compartidos con el back

Lo que **NO está** acá (vive en cognipilot-back):

- ~~Prisma~~ — Alembic owns el schema
- ~~app/api/*~~ — route handlers borrados, nginx rutea a FastAPI
- ~~firebase-admin~~ — sin FCM, polling + SSE propio en HU-18
- ~~lib/{prisma,firebase-admin,password}.ts~~ — borrados
- ~~Seed~~ — movido a `cognipilot-back/scripts/seed.py`

## Variables de entorno

Ver `.env.example`. Las dos críticas:

- `JWT_SECRET`: **mismo** que cognipilot-back para que la cookie valide cross-stack
- `BACK_API_URL`: `http://host.docker.internal:8001` (modo paralelo en la VM)
  o `http://back-api:8000` (modo bundled, post-cutover total al compose del back)

## Desarrollo local (Windows + ZeroTier)

```powershell
cp .env.example .env
# Editar .env con JWT_SECRET y BACK_API_URL=http://10.201.0.67:8001
npm install
npm run dev
```

OpenAPI / docs del back: http://10.201.0.67:8001/docs (o `http://10.201.0.67/docs` vía nginx)

## Despliegue en la VM

```bash
ssh -i F:\Proys\cognipilot-um.pem ubuntu@10.201.0.67
cd ~/cognipilot
git pull
docker compose up -d --build app
```

El nginx del compose de back ya rutea `/` a este container `cognipilot-app:3000`.

## Páginas

| Path | Tipo | Auth | Descripción |
|---|---|---|---|
| `/` | Server | público | Redirect a `/login` o `/admin` según cookie |
| `/login` | Client | público | Form de login (envía al back FastAPI) |
| `/admin` | Server | requiere cookie | Schedule editor + feed de eventos en vivo (post HU-03 con `usuarioId` asociado) |
| `/admin/empresas` | Server | `admin_sistema` | CRUD empresas (HU-01) — fetch a `/api/empresas` |
| `/admin/usuarios` | Server | `admin_sistema` o `supervisor` | CRUD usuarios (HU-02). Supervisor ve solo repartidores de su empresa. |
| `/admin/reglas` | Server | `admin_sistema` o `supervisor` | Stub — pendiente HU-04/HU-05 (motor de reglas) |
| `/admin/reportes` | Server | `gerente` | Stub — pendiente HU-14/15/16 (KPIs + export) |
| `/admin/metricas` | Server | `admin_sistema` | Pendiente — HU-21: dashboard que consume `/api/metrics/{overview,timeseries}` (Recharts/Tremor) |

## Helpers

- `lib/auth.ts` — `getAuthUser()`: lee cookie `cp_at`, verifica JWT con `JWT_SECRET`
- `lib/jwt.ts` — `verifyAccess()`: solo verify, no sign (el back firma)
- `lib/api.ts` — `serverFetch(path)`: HTTP a `BACK_API_URL`, forwarda cookies
- `lib/cuit.ts` — utilidades client-side de formato/validación CUIT

## Estado actual de las HU

Documentado en detalle en `F:\Proys\COGNIPILOT_STATUS.md`:

- **HU-01, HU-02** ✅ deployadas (empresas + usuarios con roles)
- **HU-05** ✅ ventana horaria via `/api/schedule`
- **HU-07, HU-08** ✅ accesibilidad + Poka-Yoke en la app móvil
- **HU-17** ✅ research DPC
- **HU-18** ✅ sistema de notif propio (polling + SSE) sin FCM
- **HU-19, HU-20** ✅ migración back + deploy UM-Cloud
- **HU-03** ✅ login Android con JWT + descarga ruta/reglas
- **HU-04, HU-06, HU-09, HU-10, HU-11, HU-12, HU-13, HU-14, HU-15, HU-16, HU-21** ⏳ pendientes

## Auth flow (cross-stack)

1. Browser → `POST /api/auth/login` (FastAPI valida bcrypt, firma JWT HS256)
2. FastAPI setea cookie httpOnly `cp_at` (access) y `cp_rt` (refresh)
3. Browser navega a `/admin*`
4. Next.js Server Component lee la cookie con `getAuthUser()` → verifica firma
   con el mismo `JWT_SECRET`
5. Server Component hace `serverFetch('/api/empresas')` → `lib/api.ts` forwardea
   la cookie al back → back valida y responde JSON
6. Server Component renderiza el HTML

Resultado: cookie compartida, mismo secret, **nadie se desloguea** al migrar
backends.
