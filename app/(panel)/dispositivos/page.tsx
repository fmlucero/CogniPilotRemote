// HU-35 — Vista global de dispositivos para admin/supervisor.

import { serverFetch } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import DispositivosView, { type DispositivoRow } from "./DispositivosView";

export const dynamic = "force-dynamic";

export default async function DispositivosPage() {
  const me = await requireRole("admin_sistema", "supervisor");

  const data = await serverFetch<{ dispositivos: DispositivoRow[] }>("/api/devices");

  return <DispositivosView initial={data.dispositivos} viewerRol={me.rol} />;
}
