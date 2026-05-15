import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { verifyAccess, AccessPayload, ACCESS_TTL, REFRESH_TTL } from "./jwt";

export const ACCESS_COOKIE = "cp_at";
export const REFRESH_COOKIE = "cp_rt";

// Habilitar Secure solo cuando el deploy esté detrás de HTTPS.
// El deploy actual es HTTP plano via ZeroTier, así que defaulteamos a false.
// Setear COOKIE_SECURE=true en el .env si más adelante exponés con TLS.
const cookieSecure = process.env.COOKIE_SECURE === "true";

const ACCESS_COOKIE_OPTS = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 15, // 15m
};

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30d
};

export { ACCESS_COOKIE_OPTS, REFRESH_COOKIE_OPTS, ACCESS_TTL, REFRESH_TTL };

/**
 * Extrae el access token de:
 *   1) header Authorization: Bearer <token>  (app Android)
 *   2) cookie httpOnly                       (admin web)
 */
function extractAccessToken(req?: NextRequest, cookieStore?: Awaited<ReturnType<typeof cookies>>): string | null {
  if (req) {
    const auth = req.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
  }
  return cookieStore?.get(ACCESS_COOKIE)?.value ?? null;
}

/**
 * Obtiene el usuario autenticado (para Server Components / route handlers).
 * Pasale el NextRequest cuando estás en un route handler; en server components
 * lee solo la cookie.
 */
export async function getAuthUser(req?: NextRequest): Promise<AccessPayload | null> {
  const cookieStore = req ? undefined : await cookies();
  const token = extractAccessToken(req, cookieStore ?? (await cookies()));
  if (!token) return null;
  return verifyAccess(token);
}

/**
 * Helper para route handlers que requieren auth.
 * Retorna { user, error } — si error está seteado, devolvelo como respuesta.
 */
export async function requireAuth(
  req: NextRequest,
  allowedRoles?: AccessPayload["rol"][],
): Promise<{ user: AccessPayload } | { error: { status: number; body: { error: string } } }> {
  const user = await getAuthUser(req);
  if (!user) return { error: { status: 401, body: { error: "Unauthorized" } } };
  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    return { error: { status: 403, body: { error: "Forbidden" } } };
  }
  return { user };
}
