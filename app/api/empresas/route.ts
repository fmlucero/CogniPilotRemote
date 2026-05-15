import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isValidCuit, formatCuit } from "@/lib/cuit";

export const runtime = "nodejs";

interface CreateBody {
  nombre: string;
  cuit: string;
  contacto?: {
    email?: string;
    telefono?: string;
    direccion?: string;
  };
}

// GET /api/empresas — lista todas las empresas. Solo admin_sistema.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ["admin_sistema"]);
  if ("error" in auth) return NextResponse.json(auth.error.body, { status: auth.error.status });

  const empresas = await prisma.empresa.findMany({
    orderBy: [{ activa: "desc" }, { nombre: "asc" }],
    include: {
      _count: { select: { usuarios: true, rutas: true, reglas: true } },
    },
  });

  return NextResponse.json({ empresas });
}

// POST /api/empresas — crea una empresa.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ["admin_sistema"]);
  if ("error" in auth) return NextResponse.json(auth.error.body, { status: auth.error.status });

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim();
  const cuit = body.cuit ? formatCuit(body.cuit) : "";

  if (!nombre || nombre.length < 2) {
    return NextResponse.json({ error: "El nombre es obligatorio (mínimo 2 caracteres)" }, { status: 422 });
  }
  if (!body.cuit || !isValidCuit(body.cuit)) {
    return NextResponse.json({ error: "CUIT inválido" }, { status: 422 });
  }

  const contacto = body.contacto && typeof body.contacto === "object"
    ? {
        email: typeof body.contacto.email === "string" ? body.contacto.email.trim() : undefined,
        telefono: typeof body.contacto.telefono === "string" ? body.contacto.telefono.trim() : undefined,
        direccion: typeof body.contacto.direccion === "string" ? body.contacto.direccion.trim() : undefined,
      }
    : undefined;

  try {
    const empresa = await prisma.empresa.create({
      data: { nombre, cuit, contacto: contacto ?? Prisma.JsonNull },
    });
    return NextResponse.json({ empresa }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Violación de unique: nombre o cuit ya existen
      const target = Array.isArray(err.meta?.target) ? (err.meta?.target as string[]).join(", ") : String(err.meta?.target ?? "");
      const field = target.includes("cuit") ? "CUIT" : target.includes("nombre") ? "nombre" : "campo único";
      return NextResponse.json(
        { error: `Ya existe una empresa con ese ${field}`, conflict: field },
        { status: 409 },
      );
    }
    console.error("[POST /api/empresas]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
