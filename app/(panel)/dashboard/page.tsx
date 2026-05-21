import { serverFetch } from "@/lib/api";
import DashboardClient, { type ScheduleFromBack } from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Auth ya validada en proxy + layout

  let schedule: ScheduleFromBack | null = null;
  try {
    schedule = await serverFetch<ScheduleFromBack>("/api/schedule");
  } catch {
    // Si el back está caído, mostramos defaults — el cliente repolla igual.
    schedule = null;
  }

  const lastUpdate = schedule?.updatedAt
    ? new Date(schedule.updatedAt).toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Argentina/Buenos_Aires",
      })
    : null;

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <div className="page-subtitle">Estado en vivo de la flota y reglas activas</div>
        </div>
      </div>

      <DashboardClient initialSchedule={schedule} lastUpdate={lastUpdate} />
    </>
  );
}
