// HU-47 — Live tail de peticiones HTTP capturadas por el middleware. Solo admin.

import { requireRole } from "@/lib/dal";
import PeticionesView from "./PeticionesView";

export const dynamic = "force-dynamic";

export default async function PeticionesPage() {
  await requireRole("admin_sistema");
  return <PeticionesView />;
}
