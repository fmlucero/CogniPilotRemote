// JWT verify-only — el front ya NO firma tokens (lo hace FastAPI).
// Solo valida la cookie httpOnly cp_at para que Server Components sepan quién
// está logueado sin pegar al back en cada request.

import jwt from "jsonwebtoken";

export interface AccessPayload {
  sub: string;
  email: string;
  rol: "admin_sistema" | "supervisor" | "gerente" | "repartidor";
  empresaId: string | null;
  // HU-34: id del admin original cuando el access token es de una sesión
  // de impersonación. Ausente o null en sesiones normales.
  impersonated_by?: string | null;
}

function getAccessSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET must be set");
  return s;
}

export function verifyAccess(token: string): AccessPayload | null {
  try {
    return jwt.verify(token, getAccessSecret()) as AccessPayload;
  } catch {
    return null;
  }
}
