// HU-39 — Settings globales del sistema (admin only).

import { serverFetch } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import ConfiguracionView, { type Setting } from "./ConfiguracionView";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  await requireRole("admin_sistema");
  const data = await serverFetch<{ settings: Setting[] }>("/api/admin/settings");
  return <ConfiguracionView initial={data.settings} />;
}
