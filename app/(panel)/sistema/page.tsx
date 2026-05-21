// HU-38 — Salud del sistema. Solo admin.

import { requireRole } from "@/lib/dal";
import HealthView from "./HealthView";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  await requireRole("admin_sistema");
  return <HealthView />;
}
