import { NextRequest, NextResponse } from "next/server";
import { TipoEvento, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES = Object.values(TipoEvento);

interface EventBody {
  type: TipoEvento;
  deviceUuid?: string;
  inSchedule?: boolean;
  screenName?: string;
  appPackage?: string;
  keywords?: string[];
  screenText?: string[];
}

// POST /api/events — ingesta desde la app Android.
// Mantiene compatibilidad: si la app manda `deviceUuid`, lo resolvemos a `dispositivoId`
// y derivamos `usuarioId` desde el dispositivo. Si no, queda como evento "anónimo".
export async function POST(req: NextRequest) {
  let body: Partial<EventBody>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.type || !VALID_TYPES.includes(body.type)) {
    return NextResponse.json(
      { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 422 },
    );
  }

  let dispositivoId: string | undefined;
  let usuarioId: string | undefined;
  if (body.deviceUuid) {
    const dev = await prisma.dispositivo.findUnique({
      where: { deviceUuid: body.deviceUuid },
      select: { id: true, usuarioId: true },
    });
    if (dev) {
      dispositivoId = dev.id;
      usuarioId = dev.usuarioId;
      // Touch lastSeen (sin actualizar lastLat/Lng — eso va por /api/positions)
      await prisma.dispositivo.update({
        where: { id: dev.id },
        data: { lastSeen: new Date() },
      });
    }
  }

  const evento = await prisma.eventoApp.create({
    data: {
      tipo: body.type,
      usuarioId,
      dispositivoId,
      inSchedule: typeof body.inSchedule === "boolean" ? body.inSchedule : undefined,
      screenName: body.screenName?.slice(0, 120),
      appPackage: body.appPackage?.slice(0, 120),
      keywords: Array.isArray(body.keywords)
        ? body.keywords.filter((k): k is string => typeof k === "string").slice(0, 10)
        : [],
      screenText: Array.isArray(body.screenText)
        ? body.screenText
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.slice(0, 80))
            .slice(0, 8)
        : [],
    },
  });

  return NextResponse.json({ ok: true, event: evento }, { status: 201 });
}

// GET /api/events?since=<ms>  → eventos con ts > since
// GET /api/events             → últimos 50
export async function GET(req: NextRequest) {
  const sinceParam = req.nextUrl.searchParams.get("since");

  const where: Prisma.EventoAppWhereInput = {};
  if (sinceParam) {
    const since = Number(sinceParam);
    if (!Number.isFinite(since)) {
      return NextResponse.json({ error: "since must be a number" }, { status: 422 });
    }
    where.ts = { gt: new Date(since) };
  }

  const eventos = await prisma.eventoApp.findMany({
    where,
    orderBy: { ts: "asc" },
    take: 200,
  });

  // Formato compatible con el admin actual: timestamp en ms.
  const events = eventos.map((e) => ({
    id: e.id,
    type: e.tipo,
    timestamp: e.ts.getTime(),
    deviceId: e.dispositivoId ?? "unknown",
    inSchedule: e.inSchedule ?? undefined,
    screenName: e.screenName ?? undefined,
    appPackage: e.appPackage ?? undefined,
    keywords: e.keywords,
    screenText: e.screenText,
  }));

  return NextResponse.json({ events, serverTime: Date.now() });
}
