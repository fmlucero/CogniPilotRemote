# CogniPilot — Backend & Admin

Next.js 16 + Postgres 16 + Prisma + JWT. Corre en docker-compose dentro de la VM
`Docker-Cognipilot` (UM-Cloud) y se accede vía ZeroTier en `http://10.201.0.67:3000`.

## Stack

- **Next.js 16.2.4 / React 19** — App Router, route handlers, server components.
- **Postgres 16-alpine** — gestor en docker-compose, datos en volumen `pgdata`.
- **Prisma 6** — ORM y migraciones.
- **JWT** — access (15 min) + refresh (30 días). Web usa cookies httpOnly, Android usa Bearer.
- **bcryptjs** — hash de passwords.
- **firebase-admin** — push FCM al topic `schedule-updates`.
- **pgAdmin** — opcional para inspección (puerto 5050).

## Variables de entorno

Ver `.env.example`. Generar secretos con:

```
openssl rand -hex 32
```

## Desarrollo local (Windows + ZeroTier)

Apunta a la Postgres remota:

```powershell
cp .env.example .env
# Editar DATABASE_URL apuntando a 10.201.0.67:5432 con la password real
npm install
npx prisma generate
npm run dev
```

## Despliegue en la VM

```bash
ssh -i F:\Proys\cognipilot-um.pem ubuntu@10.201.0.67
# (transferir repo con scp/rsync si todavía no está)
cd ~/cognipilot
cp .env.example .env
# editar .env con secretos reales
docker compose up -d --build
# logs
docker compose logs -f app
```

## Migraciones y seed

```bash
# Crear primera migration (desde el host con DB accesible)
npx prisma migrate dev --name init

# En la VM, las migrations se aplican solas al arrancar el container (migrate deploy)

# Cargar datos iniciales
npm run prisma:seed
```

## Endpoints

| Método | Path | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | — | Login. Web: setea cookies. Android: devuelve tokens y registra dispositivo. |
| POST | `/api/auth/logout` | — | Limpia cookies. |
| POST | `/api/auth/refresh` | refresh | Renueva access token. |
| GET  | `/api/auth/me` | access | Usuario actual. |
| POST | `/api/devices/register` | access | Upsert de dispositivo. |
| POST | `/api/events` | público (legacy) | Ingesta de eventos de la app. |
| GET  | `/api/events?since=ms` | público | Feed del admin. |
| GET  | `/api/schedule` | público | Ventana horaria activa (compat con app). |
| POST | `/api/schedule` | supervisor/admin | Crea/actualiza ventana horaria + push FCM. |

## Credenciales seed

Las contraseñas de los usuarios seed se leen desde variables de entorno
(`SEED_ADMIN_PASSWORD`, `SEED_SUPERVISOR_PASSWORD`, `SEED_GERENTE_PASSWORD`,
`SEED_REPARTIDOR_PASSWORD`). Ver `.env.example` para los nombres de variables.
Los emails de los usuarios seed están definidos en `prisma/seed.ts`.
