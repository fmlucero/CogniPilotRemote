import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isValidCuit, formatCuit } from "@/lib/cuit";

export const runtime = "nodejs";

interface PatchBody {
  nombre?: string;
  cuit?: string;
  contacto?: { email?: string; telefono?: string; direccion?: string } | null;
  activa?: boolean;
}

// GET /api/empresas/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req, ["admin_sistema"]);
  if ("error" in auth) return NextResponse.json(auth.error.body, { status: auth.error.status });

  const { id } = await params;
  const empresa = await prisma.empresa.findUnique({
    where: { id },
    include: { _count: { select: { usuarios: true, rutas: true, reglas: true } } },
  });
  if (!empresa) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ empresa });
}

// PATCH /api/empresas/[id] — editar campos o desactivar.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req, ["admin_sistema"]);
  if ("error" in auth) return NextResponse.json(auth.error.body, { status: auth.error.status });

  const { id } = await params;

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const data: Prisma.EmpresaUpdateInput = {};

  if (body.nombre !== undefined) {
    const nombre = body.nombre.trim();
    if (nombre.length < 2) {
      return NextResponse.json({ error: "Nombre inválido" }, { status: 422 });
    }
    data.nombre = nombre;
  }

  if (body.cuit !== undefined) {
    if (!isValidCuit(body.cuit)) {
      return NextResponse.json({ error: "CUIT inválido" }, { status: 422 });
    }
    data.cuit = formatCuit(body.cuit);
  }

  if (body.contacto !== undefined) {
    if (body.contacto === null) {
      data.contacto = Prisma.JsonNull;
    } else {
      data.contacto = {
        email: body.contacto.email?.trim() || undefined,
        telefono: body.contacto.telefono?.trim() || undefined,
        direccion: body.contacto.direccion?.trim() || undefined,
      };
    }
  }

  if (typeof body.activa === "boolean") data.activa = body.activa;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  try {
    const empresa = await prisma.empresa.update({
      where: { id },
      data,
      include: { _count: { select: { usuarios: true, rutas: true, reglas: true } } },
    });
    return NextResponse.json({ empresa });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") return NextResponse.json({ error: "No encontrada" }, { status: 404 });
      if (err.code === "P2002") {
        const target = Array.isArray(err.meta?.target) ? (err.meta?.target as string[]).join(", ") : String(err.meta?.target ?? "");
        const field = target.includes("cuit") ? "CUIT" : "nombre";
        return NextResponse.json(
          { error: `Ya existe otra empresa con ese ${field}`, conflict: field },
          { status: 409 },
        );
      }
    }
    console.error("[PATCH /api/empresas/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
