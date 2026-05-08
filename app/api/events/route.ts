import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { appendEvent, getEventsSince, getRecentEvents, EventRecord, EventType } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_TYPES: EventType[] = [
  "app_opened",
  "warning_shown",
  "scan_detected",
  "user_continued",
  "user_cancelled",
];

// ─── POST /api/events ────────────────────────────────────────────────────────
// Público (acordado: uso personal). Recibe un evento de la app Android y
// lo appendea al sorted set en Upstash Redis.
export async function POST(req: NextRequest) {
  let body: Partial<EventRecord>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const type = body.type;
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `\`type\` must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 422 }
    );
  }

  const deviceId = typeof body.deviceId === "string" && body.deviceId.length > 0
    ? body.deviceId.slice(0, 64)
    : "unknown";

  const timestamp = Date.now();
  const id = `${timestamp}-${Math.random().toString(36).slice(2, 10)}`;

  const event: EventRecord = {
    id,
    type,
    timestamp,
    deviceId,
    inSchedule: typeof body.inSchedule === "boolean" ? body.inSchedule : undefined,
    screenName: typeof body.screenName === "string" ? body.screenName.slice(0, 120) : undefined,
    keywords: Array.isArray(body.keywords)
      ? body.keywords.filter((k): k is string => typeof k === "string").slice(0, 10)
      : undefined,
  };

  try {
    await appendEvent(event);
  } catch (err) {
    console.error("[POST /api/events] Redis error", err);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, event }, { status: 201 });
}

// ─── GET /api/events ─────────────────────────────────────────────────────────
// Devuelve eventos. Sin auth (página /admin la tiene).
//   ?since=<ms>  → eventos con timestamp > since
//   sin since   → últimos 50 eventos
export async function GET(req: NextRequest) {
  const sinceParam = req.nextUrl.searchParams.get("since");
  try {
    if (sinceParam) {
      const since = Number(sinceParam);
      if (!Number.isFinite(since)) {
        return NextResponse.json({ error: "`since` must be a number" }, { status: 422 });
      }
      const events = await getEventsSince(since);
      return NextResponse.json({ events, serverTime: Date.now() });
    }
    const events = await getRecentEvents(50);
    return NextResponse.json({ events, serverTime: Date.now() });
  } catch (err) {
    console.error("[GET /api/events]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
