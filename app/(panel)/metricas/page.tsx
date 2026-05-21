// HU-21 — Dashboard de métricas operativas del back.
// Consume /api/metrics/overview (snapshot) + /api/metrics/timeseries (line charts).
// Sólo admin_sistema (los endpoints del back ya lo exigen; double-gate vía requireRole).

import { serverFetch } from "@/lib/api";
import { requireRole } from "@/lib/dal";
import MetricasClient, { type MetricsOverview } from "./MetricasClient";

export const dynamic = "force-dynamic";

export default async function MetricasPage() {
  await requireRole("admin_sistema");

  let initial: MetricsOverview | null = null;
  try {
    initial = await serverFetch<MetricsOverview>("/api/metrics/overview");
  } catch {
    initial = null; // el cliente reintenta vía polling
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Métricas operativas</h2>
          <div className="page-subtitle">Salud del back en tiempo real — uptime, requests, eventos, dispositivos, latencia</div>
        </div>
      </div>
      <MetricasClient initial={initial} />
    </>
  );
}
