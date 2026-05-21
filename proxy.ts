// Proxy (Next.js 16 — antes "middleware") — guard de auth + redirect por rol.
// Defensa primaria: cualquier request pasa por acá antes que page/layout.
// El back FastAPI también valida JWT en cada endpoint, así que esto es para UX
// (no para seguridad pura: si esto se cae, las páginas siguen protegidas).

import { NextResponse, type NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { ACCESS_COOKIE } from "@/lib/auth";
import { homeForRole, isAllowed } from "@/lib/nav";

interface AccessPayload {
  sub: string;
  email: string;
  rol: "admin_sistema" | "supervisor" | "gerente" | "repartidor";
  empresaId: string | null;
}

function decode(token: string | undefined): AccessPayload | null {
  if (!token) return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    return jwt.verify(token, secret) as AccessPayload;
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  const user = decode(token);

  if (path === "/") {
    if (user && user.rol !== "repartidor") {
      return NextResponse.redirect(new URL(homeForRole(user.rol), req.nextUrl));
    }
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (path === "/login") {
    if (user && user.rol !== "repartidor") {
      return NextResponse.redirect(new URL(homeForRole(user.rol), req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (user.rol === "repartidor") {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("msg", "use-app");
    return NextResponse.redirect(url);
  }

  if (!isAllowed(user.rol, path)) {
    return NextResponse.redirect(new URL(homeForRole(user.rol), req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Excluye assets estáticos, rutas de Next, y cualquier archivo con extensión (favicon, etc).
  // Las rutas /api/* del front no existen post-cutover (todo va a nginx → FastAPI),
  // así que no hace falta excluirlas, pero las dejo por defensa.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
