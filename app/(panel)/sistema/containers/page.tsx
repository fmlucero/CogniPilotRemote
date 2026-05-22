// HU-45 — Inventario detallado de containers (admin only).

import { requireRole } from "@/lib/dal";
import ContainersView from "./ContainersView";

export const dynamic = "force-dynamic";

export default async function ContainersPage() {
  await requireRole("admin_sistema");
  return <ContainersView />;
}
