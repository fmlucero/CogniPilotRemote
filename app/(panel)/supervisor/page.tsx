// HU-26 — Home dedicada del supervisor.
// Muestra header personalizado + KPIs de su flota + mapa + listado de repartidores.

import { serverFetch } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import SupervisorView, { type RepartidorRow } from "./SupervisorView";

interface UsuarioFromBack {
  id: string;
  email: string;
  nombre: string;
  rol: "admin_sistema" | "supervisor" | "gerente" | "repartidor";
  empresaId: string | null;
  empresaNombre: string | null;
  activo: boolean;
  dispositivos: number;
  connectionState: "online" | "active_today" | "offline";
  lastSeen: number | null;
  createdAt: number;
}

export const dynamic = "force-dynamic";

interface MeResponse {
  user: { id: string; email: string; nombre: string; rol: string; empresaId: string | null };
}

export default async function SupervisorPage() {
  await requireRole("supervisor");

  // Fetch en paralelo: nombre del supervisor + listado de repartidores de su empresa
  const [meResp, data] = await Promise.all([
    serverFetch<MeResponse>("/api/auth/me"),
    serverFetch<{ usuarios: UsuarioFromBack[] }>("/api/usuarios"),
  ]);

  const repartidores: RepartidorRow[] = data.usuarios
    .filter((u) => u.rol === "repartidor")
    .map((u) => ({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      activo: u.activo,
      dispositivos: u.dispositivos,
      connectionState: u.connectionState,
      lastSeen: u.lastSeen,
    }));

  const empresaNombre =
    data.usuarios.find((u) => u.empresaNombre)?.empresaNombre ?? "Tu empresa";

  return (
    <SupervisorView
      viewerNombre={meResp.user.nombre}
      empresaNombre={empresaNombre}
      repartidores={repartidores}
    />
  );
}
