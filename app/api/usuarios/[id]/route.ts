import { NextRequest, NextResponse } from "next/server";
import { Prisma, Rol } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { generateTempPassword } from "@/lib/password";

export const runtime = "nodejs";

interface PatchBody {
  nombre?: string;
  rol?: Rol;
  empresaId?: string | null;
  activo?: boolean;
  // Opciones para reseteo de password
  password?: string;        // si viene, se usa esa
  resetPassword?: boolean;  // si true y no viene password, autogenera una temp
}

const VALID_ROLES: Rol[] = ["admin_sistema", "supervisor", "gerente", "repartidor"];

// PATCH /api/usuarios/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req, ["admin_sistema", "supervisor"]);
  if ("error" in auth) return NextResponse.json(auth.error.body, { status: auth.error.status });

  const { id } = await params;

  // Cargar usuario primero para validar permisos
  const target = await prisma.usuario.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Usuario no existe" }, { status: 404 });

  // Supervisor solo puede operar sobre repartidores de su misma empresa
  if (auth.user.rol === "supervisor") {
    if (target.rol !== "repartidor" || target.empresaId !== auth.user.empresaId) {
      return NextResponse.json({ error: "Sin permiso para modificar este usuario" }, { status: 403 });
    }
  }

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const data: Prisma.UsuarioUpdateInput = {};

  if (body.nombre !== undefined) {
    const n = body.nombre.trim();
    if (n.length < 2) return NextResponse.json({ error: "Nombre inválido" }, { status: 422 });
    data.nombre = n;
  }

  if (body.rol !== undefined) {
    if (auth.user.rol === "supervisor") {
      return NextResponse.json({ error: "Supervisor no puede cambiar roles" }, { status: 403 });
    }
    if (!VALID_ROLES.includes(body.rol)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 422 });
    }
    data.rol = body.rol;
  }

  if (body.empresaId !== undefined) {
    if (auth.user.rol === "supervisor") {
      return NextResponse.json({ error: "Supervisor no puede reasignar empresas" }, { status: 403 });
    }
    if (body.empresaId === null) {
      // Solo válido si el rol final es admin_sistema
      const finalRol = (data.rol as Rol) ?? target.rol;
      if (finalRol !== "admin_sistema") {
        return NextResponse.json({ error: "Solo admin_sistema puede no tener empresa" }, { status: 422 });
      }
      data.empresa = { disconnect: true };
    } else {
      const empresa = await prisma.empresa.findUnique({ where: { id: body.empresaId } });
      if (!empresa) return NextResponse.json({ error: "Empresa no existe" }, { status: 422 });
      data.empresa = { connect: { id: body.empresaId } };
    }
  }

  if (typeof body.activo === "boolean") {
    if (body.activo === false && id === auth.user.sub) {
      return NextResponse.json({ error: "No podés desactivar tu propio usuario" }, { status: 400 });
    }
    data.activo = body.activo;
  }

  // Manejo de password
  let tempPassword: string | undefined;
  let generated = false;
  if (body.password !== undefined) {
    if (body.password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 422 });
    }
    data.passwordHash = bcrypt.hashSync(body.password, 10);
    tempPassword = body.password;
  } else if (body.resetPassword) {
    tempPassword = generateTempPassword(12);
    data.passwordHash = bcrypt.hashSync(tempPassword, 10);
    generated = true;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  try {
    const usuario = await prisma.usuario.update({
      where: { id },
      data,
      include: {
        empresa: { select: { id: true, nombre: true } },
        _count: { select: { dispositivos: true } },
      },
    });
    return NextResponse.json({
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
        empresaId: usuario.empresaId,
        empresaNombre: usuario.empresa?.nombre ?? null,
        activo: usuario.activo,
        dispositivos: usuario._count.dispositivos,
        createdAt: usuario.createdAt.getTime(),
      },
      tempPassword,
      passwordGenerated: generated,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Usuario no existe" }, { status: 404 });
    }
    console.error("[PATCH /api/usuarios/[id]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
