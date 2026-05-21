// Data Access Layer — única fuente de "quién está logueado" para Server Components.
// Cacheado por request con React `cache()` para que múltiples llamadas dentro del
// mismo render NO repitan la verificación del JWT.
//
// Por qué este wrapper sobre getAuthUser: el doc oficial de Next 16 recomienda
// no hacer auth checks directamente en layout (no re-renderean en soft nav).
// Hacemos el check vía proxy.ts (que sí corre en cada request) y en cada page
// vía requireUser() para defensa en profundidad.

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "./auth";
import { homeForRole, isAllowed, type Rol } from "./nav";
import type { AccessPayload } from "./jwt";

export const currentUser = cache(async (): Promise<AccessPayload | null> => {
  return getAuthUser();
});

export async function requireUser(): Promise<AccessPayload> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...allowed: Rol[]): Promise<AccessPayload> {
  const user = await requireUser();
  if (!allowed.includes(user.rol)) redirect(homeForRole(user.rol));
  return user;
}

export async function requirePath(path: string): Promise<AccessPayload> {
  const user = await requireUser();
  if (!isAllowed(user.rol, path)) redirect(homeForRole(user.rol));
  return user;
}
