import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signAccess, signRefresh } from "@/lib/jwt";
import { ACCESS_COOKIE, REFRESH_COOKIE, ACCESS_COOKIE_OPTS, REFRESH_COOKIE_OPTS } from "@/lib/auth";

export const runtime = "nodejs";

interface LoginBody {
  email: string;
  password: string;
  // Si viene de la app Android, mandar deviceUuid para auto-registrar/actualizar:
  deviceUuid?: string;
  fcmToken?: string;
  modelo?: string;
  osVersion?: string;
  appVersion?: string;
}

// POST /api/auth/login
// Web: setea cookies httpOnly y responde { user }.
// Android: devuelve { user, accessToken, refreshToken } y registra dispositivo.
export async function POST(req: NextRequest) {
  let body: LoginBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 422 });
  }

  const user = await prisma.usuario.findUnique({ where: { email: body.email.toLowerCase() } });
  if (!user || !user.activo) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await bcrypt.compare(body.password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Auto-registrar dispositivo si vino con deviceUuid (app Android)
  let dispositivoId: string | null = null;
  if (body.deviceUuid) {
    const dispositivo = await prisma.dispositivo.upsert({
      where: { deviceUuid: body.deviceUuid },
      update: {
        usuarioId: user.id,
        fcmToken: body.fcmToken,
        modelo: body.modelo,
        osVersion: body.osVersion,
        appVersion: body.appVersion,
        lastSeen: new Date(),
        activo: true,
      },
      create: {
        usuarioId: user.id,
        deviceUuid: body.deviceUuid,
        fcmToken: body.fcmToken,
        modelo: body.modelo,
        osVersion: body.osVersion,
        appVersion: body.appVersion,
      },
    });
    dispositivoId = dispositivo.id;
  }

  const accessToken = signAccess({
    sub: user.id,
    email: user.email,
    rol: user.rol,
    empresaId: user.empresaId,
  });
  const refreshToken = signRefresh(user.id);

  const responseBody = {
    user: {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      empresaId: user.empresaId,
    },
    dispositivoId,
    accessToken,
    refreshToken,
  };

  const res = NextResponse.json(responseBody);
  res.cookies.set(ACCESS_COOKIE, accessToken, ACCESS_COOKIE_OPTS);
  res.cookies.set(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS);
  return res;
}
