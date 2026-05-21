// HU-13 + HU-37 — Vista filtrable de incidentes + export CSV.
// Subset de EventoApp: scan_detected, user_continued, warning_shown.

import { requireRole } from "@/lib/dal";
import IncidentesView from "./IncidentesView";

export const dynamic = "force-dynamic";

export default async function IncidentesPage() {
  const me = await requireRole("admin_sistema", "supervisor");

  return <IncidentesView viewerRol={me.rol} />;
}
