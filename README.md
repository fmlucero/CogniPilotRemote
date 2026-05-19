# CogniPilot Front (Next.js admin UI)

Next.js 16 + React 19. **SOLO UI** — el back API vive en
[cognipilot-back](https://github.com/fmlucero/CogniPilotBack) (FastAPI).

Corre en docker-compose dentro de la VM `Docker-Cognipilot` (UM-Cloud) y se
accede vía:
- ZeroTier interno: `http://10.201.0.67:3000`
- Internet (via nginx + Cloudflare Tunnel del compose de back)

## Arquitectura post-cutover

```
   Browser (admin)
        │ HTTPS
        ▼
   Cloudflare Tunnel
        │
        ▼
   nginx :80 (cognipilot-back)
   ├── /api/*  → FastAPI :8000 (cognipilot-back-api)
   └── /       → este front :3000 (cognipilot-app)
                  └── Server Components hacen fetch a BACK_API_URL
                      via lib/api.ts (serverFetch + cookie forwarding)
```

## Stack

- **Next.js 16.2.4 / React 19** — App Router con Server Components
- **jsonwebtoken** — verify-only de la cookie `cp_at` (firmada por FastAPI)
- **Postgres 16-alpine** + **pgAdmin** — todavía en este compose, compartido con el back

Lo que **NO está** acá (vive en cognipilot-back):
- ~~Prisma~~ (Alembic owns el schema desde HU-18)
- ~~app/api/*~~ (route handlers borrados, nginx rutea a FastAPI)
- ~~firebase-admin~~ (sin FCM, polling + SSE propio — ver HU-18)
- ~~lib/{prisma,firebase-admin,password}.ts~~ (borrados)
- ~~Seed~~ (movido a `cognipilot-back/scripts/seed.py`)

## Variables de entorno

Ver `.env.example`. Las dos críticas:

- `JWT_SECRET`: **mismo** que cognipilot-back para que la cookie validate cross-stack
- `BACK_API_URL`: `http://host.docker.internal:8001` (parallel mode en la VM)

## Desarrollo local (Windows + ZeroTier)

```powershell
cp .env.example .env
# Editar .env con JWT_SECRET y BACK_API_URL=http://10.201.0.67:8001
npm install
npm run dev
```

OpenAPI / docs del back: http://10.201.0.67:8001/docs

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
| `/` | Server | público | Redirect a /login o /admin según cookie |
| `/login` | Client | público | Form de login |
| `/admin` | Server | requiere cookie | Dashboard con schedule + feed eventos + mapa |
| `/admin/empresas` | Server | admin_sistema | CRUD empresas (fetch a /api/empresas) |
| `/admin/usuarios` | Server | admin_sistema/supervisor | CRUD usuarios |
| `/admin/reglas` | Server | TBD | Stub — pendiente |
| `/admin/reportes` | Server | TBD | Stub — pendiente |

## Helpers

- `lib/auth.ts` — `getAuthUser()`: lee cookie `cp_at`, verifica JWT con `JWT_SECRET`
- `lib/jwt.ts` — `verifyAccess()`: solo verify, no sign (el back firma)
- `lib/api.ts` — `serverFetch(path)`: HTTP a `BACK_API_URL`, forwarda cookies
- `lib/cuit.ts` — utilidades client-side de formato/validación CUIT
