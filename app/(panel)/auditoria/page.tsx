// HU-36 — Auditoría persistida (admin_sistema only).
// Sirve el histórico de eventos sensibles (login, impersonate, etc.) en DB.

import { requireRole } from "@/lib/dal";
import AuditoriaView from "./AuditoriaView";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  await requireRole("admin_sistema");
  return <AuditoriaView />;
}
