// HU-25 — Solicitudes de reset de password (admin only).

import { serverFetch } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import SolicitudesView, { type ResetRequest } from "./SolicitudesView";

export const dynamic = "force-dynamic";

export default async function SolicitudesPage() {
  await requireRole("admin_sistema");
  const data = await serverFetch<{ requests: ResetRequest[] }>(
    "/api/admin/reset-requests?soloPendientes=true"
  );
  return <SolicitudesView initial={data.requests} />;
}
