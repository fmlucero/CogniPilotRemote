import jwt from "jsonwebtoken";
import type { Rol } from "@prisma/client";

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

function getAccessSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET must be set");
  return s;
}

function getRefreshSecret(): string {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s) throw new Error("JWT_REFRESH_SECRET must be set");
  return s;
}

export function signAccess(payload: AccessPayload): string {
  return jwt.sign(payload, getAccessSecret(), { expiresIn: ACCESS_TTL });
}

export function signRefresh(userId: string): string {
  const payload: RefreshPayload = { sub: userId, type: "refresh" };
  return jwt.sign(payload, getRefreshSecret(), { expiresIn: REFRESH_TTL });
}

export function verifyAccess(token: string): AccessPayload | null {
  try {
    return jwt.verify(token, getAccessSecret()) as AccessPayload;
  } catch {
    return null;
  }
}

export function verifyRefresh(token: string): RefreshPayload | null {
  try {
    const decoded = jwt.verify(token, getRefreshSecret()) as RefreshPayload;
    if (decoded.type !== "refresh") return null;
    return decoded;
  } catch {
    return null;
  }
}
