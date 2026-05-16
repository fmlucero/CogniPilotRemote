// Helper de auth para Server Components: lee la cookie httpOnly y valida el JWT.
//
// Post-cutover el front YA NO setea cookies (lo hace FastAPI en /api/auth/login).
// Acá solo VALIDAMOS la cookie para saber quién está logueado, sin tocar la DB.

import "server-only";
import { cookies } from "next/headers";
import { verifyAccess, type AccessPayload } from "./jwt";

export const ACCESS_COOKIE = "cp_at";
export const REFRESH_COOKIE = "cp_rt";

/**
 * Devuelve el usuario actual decodificando el JWT de la cookie cp_at,
 * o null si no hay cookie / la firma falla / expiró.
 *
 * Uso típico en Server Components:
 *   const user = await getAuthUser();
 *   if (!user) redirect("/login");
 */
export async function getAuthUser(): Promise<AccessPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccess(token);
}
