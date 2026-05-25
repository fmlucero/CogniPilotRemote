// HU-49 — Version/build info. Solo admin.

import { requireRole } from "@/lib/dal";
import VersionView from "./VersionView";

export const dynamic = "force-dynamic";

export default async function VersionPage() {
  await requireRole("admin_sistema");
  return <VersionView />;
}
