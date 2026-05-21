// HU-27 + HU-14 + HU-16 — Home dedicada del gerente.
// KPIs históricos + gráficos + export CSV. Solo rol gerente.

import { serverFetch } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import GerenteView, { type KpisData } from "./GerenteView";

interface MeResponse {
  user: { id: string; email: string; nombre: string; rol: string; empresaId: string | null };
}

export const dynamic = "force-dynamic";

export default async function GerentePage() {
  await requireRole("gerente");

  const [meResp, kpis] = await Promise.all([
    serverFetch<MeResponse>("/api/auth/me"),
    serverFetch<KpisData>("/api/metrics/kpis"), // rango default = últimos 7 días
  ]);

  // Sacamos el nombre de empresa del primer top_user que lo tenga (todos son de la misma empresa).
  // Si no hay top_users (DB vacía o sin eventos en el rango), queda el default.
  const empresaNombre =
    kpis.top_users.find((u) => u.empresaNombre)?.empresaNombre ?? "Tu empresa";

  return (
    <GerenteView
      viewerNombre={meResp.user.nombre}
      empresaNombre={empresaNombre}
      initial={kpis}
    />
  );
}
