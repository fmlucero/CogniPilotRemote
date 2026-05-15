import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

interface RegisterBody {
  deviceUuid: string;
  fcmToken?: string;
  modelo?: string;
  osVersion?: string;
  appVersion?: string;
}

// POST /api/devices/register
// Usado por la app Android cuando el repartidor inicia sesión o se reconecta.
// Idempotente: upsert por deviceUuid.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return NextResponse.json(auth.error.body, { status: auth.error.status });

  let body: RegisterBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.deviceUuid) {
    return NextResponse.json({ error: "deviceUuid is required" }, { status: 422 });
  }

  const dispositivo = await prisma.dispositivo.upsert({
    where: { deviceUuid: body.deviceUuid },
    update: {
      usuarioId: auth.user.sub,
      fcmToken: body.fcmToken,
      modelo: body.modelo,
      osVersion: body.osVersion,
      appVersion: body.appVersion,
      lastSeen: new Date(),
      activo: true,
    },
    create: {
      usuarioId: auth.user.sub,
      deviceUuid: body.deviceUuid,
      fcmToken: body.fcmToken,
      modelo: body.modelo,
      osVersion: body.osVersion,
      appVersion: body.appVersion,
    },
  });

  return NextResponse.json({ dispositivo: { id: dispositivo.id, deviceUuid: dispositivo.deviceUuid } });
}
