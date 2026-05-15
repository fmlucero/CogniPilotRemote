import { NextRequest, NextResponse } from "next/server";
import { Prisma, Rol } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { generateTempPassword } from "@/lib/password";

export const runtime = "nodejs";

interface CreateBody {
  nombre: string;
  email: string;
  rol: Rol;
  empresaId?: string | null;
  password?: string; // si no viene, se autogenera
}

const VALID_ROLES: Rol[] = ["admin_sistema", "supervisor", "gerente", "repartidor"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/usuarios
//   admin_sistema: todos
//   supervisor: solo los de su empresa
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ["admin_sistema", "supervisor"]);
  if ("error" in auth) return NextResponse.json(auth.error.body, { status: auth.error.status });

  const where: Prisma.UsuarioWhereInput = {};
  if (auth.user.rol === "supervisor") {
    if (!auth.user.empresaId) return NextResponse.json({ usuarios: [] });
    where.empresaId = auth.user.empresaId;
  }

  const usuarios = await prisma.usuario.findMany({
    where,
    orderBy: [{ activo: "desc" }, { rol: "asc" }, { nombre: "asc" }],
    include: {
      empresa: { select: { id: true, nombre: true } },
      _count: { select: { dispositivos: true } },
    },
  });

  return NextResponse.json({
    usuarios: usuarios.map((u) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      rol: u.rol,
      empresaId: u.empresaId,
      empresaNombre: u.empresa?.nombre ?? null,
      activo: u.activo,
      dispositivos: u._count.dispositivos,
      createdAt: u.createdAt.getTime(),
    })),
  });
}

// POST /api/usuarios
//   admin_sistema: puede crear cualquier rol/empresa
//   supervisor: solo crea repartidores en su misma empresa
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ["admin_sistema", "supervisor"]);
  if ("error" in auth) return NextResponse.json(auth.error.body, { status: auth.error.status });

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim();
  const email = body.email?.trim().toLowerCase();
  const rol = body.rol;
  let empresaId: string | null | undefined = body.empresaId ?? null;

  if (!nombre || nombre.length < 2) {
    return NextResponse.json({ error: "Nombre inválido (mínimo 2 caracteres)" }, { status: 422 });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 422 });
  }
  if (!VALID_ROLES.includes(rol)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 422 });
  }

  // Reglas de empresaId según rol
  if (rol === "admin_sistema") {
    empresaId = null; // admin_sistema es transversal
  } else {
    if (!empresaId) {
      return NextResponse.json({ error: "Empresa requerida para este rol" }, { status: 422 });
    }
    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
    if (!empresa) return NextResponse.json({ error: "Empresa no existe" }, { status: 422 });
    if (!empresa.activa) return NextResponse.json({ error: "Empresa inactiva" }, { status: 422 });
  }

  // Restricciones del supervisor
  if (auth.user.rol === "supervisor") {
    if (rol !== "repartidor") {
      return NextResponse.json({ error: "El supervisor solo puede crear repartidores" }, { status: 403 });
    }
    if (empresaId !== auth.user.empresaId) {
      return NextResponse.json({ error: "El supervisor solo puede crear usuarios en su empresa" }, { status: 403 });
    }
  }

  // Password: usar la del body o autogenerar
  let plainPassword = body.password?.trim();
  let generated = false;
  if (!plainPassword) {
    plainPassword = generateTempPassword(12);
    generated = true;
  } else if (plainPassword.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 422 });
  }

  const passwordHash = bcrypt.hashSync(plainPassword, 10);

  try {
    const usuario = await prisma.usuario.create({
      data: { nombre, email, rol, empresaId, passwordHash },
      include: { empresa: { select: { id: true, nombre: true } } },
    });

    return NextResponse.json(
      {
        usuario: {
          id: usuario.id,
          email: usuario.email,
          nombre: usuario.nombre,
          rol: usuario.rol,
          empresaId: usuario.empresaId,
          empresaNombre: usuario.empresa?.nombre ?? null,
          activo: usuario.activo,
          dispositivos: 0,
          createdAt: usuario.createdAt.getTime(),
        },
        // La password se devuelve UNA SOLA VEZ. Si fue autogenerada, hay que copiarla.
        tempPassword: plainPassword,
        passwordGenerated: generated,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un usuario con ese email", conflict: "email" }, { status: 409 });
    }
    console.error("[POST /api/usuarios]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
