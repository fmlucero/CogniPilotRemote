import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccess, signRefresh, verifyRefresh } from "@/lib/jwt";
import { ACCESS_COOKIE, REFRESH_COOKIE, ACCESS_COOKIE_OPTS, REFRESH_COOKIE_OPTS } from "@/lib/auth";

export const runtime = "nodejs";

// POST /api/auth/refresh
// Web: lee refresh token de la cookie.
// Android: { refreshToken } en body.
export async function POST(req: NextRequest) {
  let refreshToken: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    refreshToken = body.refreshToken;
  } catch {
    // sin body, ok
  }
  if (!refreshToken) {
    refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  }
  if (!refreshToken) {
    return NextResponse.json({ error: "Missing refresh token" }, { status: 401 });
  }

  const payload = verifyRefresh(refreshToken);
  if (!payload) {
    return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
  }

  const user = await prisma.usuario.findUnique({ where: { id: payload.sub } });
  if (!user || !user.activo) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const newAccess = signAccess({
    sub: user.id,
    email: user.email,
    rol: user.rol,
    empresaId: user.empresaId,
  });
  const newRefresh = signRefresh(user.id);

  const res = NextResponse.json({ accessToken: newAccess, refreshToken: newRefresh });
  res.cookies.set(ACCESS_COOKIE, newAccess, ACCESS_COOKIE_OPTS);
  res.cookies.set(REFRESH_COOKIE, newRefresh, REFRESH_COOKIE_OPTS);
  return res;
}
