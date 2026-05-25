// HU-48 — Estado del worker arq. Solo admin.

import { requireRole } from "@/lib/dal";
import WorkerView from "./WorkerView";

export const dynamic = "force-dynamic";

export default async function WorkerPage() {
  await requireRole("admin_sistema");
  return <WorkerView />;
}
