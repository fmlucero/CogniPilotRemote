// HU-12 — Lista de alertas (admin / supervisor / gerente).

import { requireRole } from "@/lib/dal";
import AlertasView from "./AlertasView";

export const dynamic = "force-dynamic";

export default async function AlertasPage() {
  const me = await requireRole("admin_sistema", "supervisor", "gerente");
  return <AlertasView viewerRol={me.rol} />;
}
