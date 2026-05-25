// HU-46 — Topología del stack: diagrama (SVG) + tabla. Solo admin.

import { requireRole } from "@/lib/dal";
import RedView from "./RedView";

export const dynamic = "force-dynamic";

export default async function RedPage() {
  await requireRole("admin_sistema");
  return <RedView />;
}
