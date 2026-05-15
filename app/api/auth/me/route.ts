import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/auth/me — devuelve el usuario actual desde el JWT.
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.usuario.findUnique({
    where: { id: auth.sub },
    select: {
      id: true,
      email: true,
      nombre: true,
      rol: true,
      empresaId: true,
      activo: true,
    },
  });
  if (!user || !user.activo) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ user });
}
