// Helpers compartidos para el estado de conexión del usuario (HU-23).
// El back devuelve el state computado; acá solo mappeamos a label + class CSS.

export type ConnectionState = "online" | "active_today" | "offline";

export const CONNECTION_LABEL: Record<ConnectionState, string> = {
  online: "Conectado",
  active_today: "Activo hoy",
  offline: "Desconectado",
};

export const CONNECTION_PILL: Record<ConnectionState, string> = {
  online: "pill-on",
  active_today: "pill-warn",
  offline: "pill-off",
};

const REL_FORMAT = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

export function lastSeenLabel(lastSeenMs: number | null): string {
  if (!lastSeenMs) return "Nunca";
  const deltaMs = Date.now() - lastSeenMs;
  const sec = Math.floor(deltaMs / 1000);
  if (sec < 60) return "hace segundos";
  const min = Math.floor(sec / 60);
  if (min < 60) return REL_FORMAT.format(-min, "minute");
  const hour = Math.floor(min / 60);
  if (hour < 24) return REL_FORMAT.format(-hour, "hour");
  const day = Math.floor(hour / 24);
  return REL_FORMAT.format(-day, "day");
}

export function lastSeenAbsolute(lastSeenMs: number | null): string {
  if (!lastSeenMs) return "—";
  return new Date(lastSeenMs).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}
