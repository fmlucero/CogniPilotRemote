// Server-side fetch helper hacia el back FastAPI (cognipilot-back).
//
// Forwarda las cookies httpOnly del request actual (cp_at, cp_rt) al back
// para que el JWT viaje y los endpoints role-protegidos respondan.
//
// URL configurable via env: BACK_API_URL (default = host gateway en la VM).
//   - Modo paralelo (mientras el front sigue en cognipilot-app):
//     BACK_API_URL=http://host.docker.internal:8001
//   - Modo bundled (post-cutover total, front en el mismo compose que el back):
//     BACK_API_URL=http://back-api:8000

import "server-only";
import { cookies } from "next/headers";

const BACK_API_URL = process.env.BACK_API_URL ?? "http://host.docker.internal:8001";

interface ServerFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  /** Si true (default), no cachea — datos frescos por request. */
  noStore?: boolean;
}

export async function serverFetch<T>(
  path: string,
  options: ServerFetchOptions = {},
): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const { noStore = true, headers = {}, ...init } = options;

  const res = await fetch(`${BACK_API_URL}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    cache: noStore ? "no-store" : "default",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Back API ${path} → HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}
