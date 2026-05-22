// HU-43 — Pre-flight check de los dispositivos antes de la jornada.
// Admin / supervisor / gerente.

import { serverFetch } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import JornadaView from "./JornadaView";
import type { DispositivoRow } from "../dispositivos/DispositivosView";

export const dynamic = "force-dynamic";

export default async function JornadaPage() {
  const me = await requireRole("admin_sistema", "supervisor", "gerente");

  const data = await serverFetch<{ dispositivos: DispositivoRow[] }>("/api/devices");

  return <JornadaView initial={data.dispositivos} viewerRol={me.rol} />;
}
