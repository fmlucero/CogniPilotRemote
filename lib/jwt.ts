import jwt from "jsonwebtoken";
import type { Rol } from "@prisma/client";

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be set");
}

export const ACCESS_TTL = "15m";
export const REFRESH_TTL = "30d";

export interface AccessPayload {
  sub: string;          // usuarioId
  email: string;
  rol: Rol;
  empresaId: string | null;
}

export interface RefreshPayload {
  sub: string;
  type: "refresh";
}

export function signAccess(payload: AccessPayload): string {
  return jwt.sign(payload, ACCESS_SECRET as string, { expiresIn: ACCESS_TTL });
}

export function signRefresh(userId: string): string {
  const payload: RefreshPayload = { sub: userId, type: "refresh" };
  return jwt.sign(payload, REFRESH_SECRET as string, { expiresIn: REFRESH_TTL });
}

export function verifyAccess(token: string): AccessPayload | null {
  try {
    return jwt.verify(token, ACCESS_SECRET as string) as AccessPayload;
  } catch {
    return null;
  }
}

export function verifyRefresh(token: string): RefreshPayload | null {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET as string) as RefreshPayload;
    if (decoded.type !== "refresh") return null;
    return decoded;
  } catch {
    return null;
  }
}
