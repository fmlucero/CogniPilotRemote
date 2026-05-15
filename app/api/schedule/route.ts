import { NextRequest, NextResponse } from "next/server";
import { TipoRegla, AccionRegla, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { sendSchedulePush } from "@/lib/firebase-admin";

export const runtime = "nodejs";

// Mantiene la forma vieja `{ enabled, from, to, tz, updatedAt, updatedBy }`
// pero detrás es la regla `ventana_horaria` activa de la empresa del usuario.
//
// GET es público (la app Android lo usa como fallback al push FCM).
// POST requiere supervisor o admin.

interface ScheduleShape {
  enabled: boolean;
  from: string | null;
  to: string | null;
  tz: string | null;
  updatedAt: number | null;
  updatedBy: string | null;
}

function reglaToShape(regla: {
  activa: boolean;
  condicion: unknown;
  updatedAt: Date;
  empresa: { id: string };
} | null, updatedBy: string | null): ScheduleShape {
  if (!regla) {
    return { enabled: false, from: null, to: null, tz: null, updatedAt: null, updatedBy: null };
  }
  const cond = regla.condicion as { desde?: string; hasta?: string; tz?: string } | null;
  return {
    enabled: regla.activa,
    from: cond?.desde ?? null,
    to: cond?.hasta ?? null,
    tz: cond?.tz ?? null,
    updatedAt: regla.updatedAt.getTime(),
    updatedBy,
  };
}

// GET — devuelve la primera regla ventana_horaria de la primera empresa activa.
// Con multi-empresa futuro habría que pasar empresaId/rutaId.
export async function GET() {
  try {
    const regla = await prisma.regla.findFirst({
      where: { tipo: TipoRegla.ventana_horaria, ruta: null },
      orderBy: { updatedAt: "desc" },
      include: {
        empresa: { select: { id: true } },
        historial: {
          orderBy: { ts: "desc" },
          take: 1,
          include: { usuario: { select: { email: true, nombre: true } } },
        },
      },
    });
    const updatedBy = regla?.historial?.[0]?.usuario?.email ?? null;
    return NextResponse.json(reglaToShape(regla, updatedBy));
  } catch (err) {
    console.error("[GET /api/schedule]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — supervisor/admin. Actualiza la regla ventana_horaria de su empresa.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ["supervisor", "admin_sistema"]);
  if ("error" in auth) return NextResponse.json(auth.error.body, { status: auth.error.status });

  let body: { enabled: boolean; from: string; to: string; tz: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { enabled, from, to, tz } = body;
  const timeRe = /^\d{2}:\d{2}$/;
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be boolean" }, { status: 422 });
  }
  if (enabled && (!timeRe.test(from) || !timeRe.test(to))) {
    return NextResponse.json({ error: "from/to must be HH:mm" }, { status: 422 });
  }
  if (!tz) {
    return NextResponse.json({ error: "tz is required" }, { status: 422 });
  }

  // Resolver empresa: admin_sistema necesita ?empresaId=…, supervisor usa la suya.
  let empresaId = auth.user.empresaId;
  if (auth.user.rol === "admin_sistema") {
    const param = new URL(req.url).searchParams.get("empresaId");
    if (param) empresaId = param;
  }
  if (!empresaId) {
    return NextResponse.json({ error: "empresaId required (admin must pass ?empresaId=)" }, { status: 422 });
  }

  // Buscar regla existente (única ventana_horaria global de la empresa)
  const existing = await prisma.regla.findFirst({
    where: { empresaId, tipo: TipoRegla.ventana_horaria, ruta: null },
  });

  const condicion = { desde: from, hasta: to, tz };

  const regla = await prisma.$transaction(async (tx) => {
    let r;
    if (existing) {
      const before = { activa: existing.activa, condicion: existing.condicion };
      r = await tx.regla.update({
        where: { id: existing.id },
        data: { activa: enabled, condicion },
      });
      await tx.reglaHistorial.create({
        data: {
          reglaId: r.id,
          usuarioId: auth.user.sub,
          campo: "(actualización)",
          valorOld: before,
          valorNew: { activa: enabled, condicion },
        },
      });
    } else {
      r = await tx.regla.create({
        data: {
          empresaId,
          nombre: "Ventana horaria",
          tipo: TipoRegla.ventana_horaria,
          accion: AccionRegla.bloquear,
          activa: enabled,
          condicion,
        },
      });
      await tx.reglaHistorial.create({
        data: {
          reglaId: r.id,
          usuarioId: auth.user.sub,
          campo: "(creación)",
          valorOld: Prisma.JsonNull,
          valorNew: { activa: enabled, condicion },
        },
      });
    }
    return r;
  });

  // Push FCM (best-effort)
  let fcmMessageId: string | null = null;
  let fcmError: string | null = null;
  try {
    fcmMessageId = await sendSchedulePush({ enabled, from, to, tz });
  } catch (err) {
    fcmError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(
    {
      ...reglaToShape({ ...regla, empresa: { id: empresaId } }, auth.user.email),
      fcmMessageId,
      fcmError,
    },
    { status: fcmError ? 207 : 200 },
  );
}
