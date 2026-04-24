import { NextResponse } from "next/server";
import { getSchedule, setSchedule } from "@/lib/kv";
import { sendSchedulePush } from "@/lib/firebase-admin";
import { getAuthUser } from "@/lib/session";

// ─── GET /api/schedule ───────────────────────────────────────────────────────
// Público. Fallback de la app si no recibe el push FCM.
export async function GET() {
  try {
    const schedule = await getSchedule();
    if (!schedule) {
      return NextResponse.json(
        { enabled: false, from: null, to: null, tz: null, updatedAt: null, updatedBy: null },
        { status: 200 }
      );
    }
    return NextResponse.json(schedule);
  } catch (err) {
    console.error("[GET /api/schedule]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/schedule ──────────────────────────────────────────────────────
// Protegido. Guarda el horario en KV y dispara el push FCM.
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { enabled: boolean; from: string; to: string; tz: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { enabled, from, to, tz } = body;

  // Validaciones básicas
  const timeRe = /^\d{2}:\d{2}$/;
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "`enabled` must be boolean" }, { status: 422 });
  }
  if (enabled && !timeRe.test(from)) {
    return NextResponse.json({ error: "`from` must be HH:mm" }, { status: 422 });
  }
  if (enabled && !timeRe.test(to)) {
    return NextResponse.json({ error: "`to` must be HH:mm" }, { status: 422 });
  }
  if (!tz || typeof tz !== "string") {
    return NextResponse.json({ error: "`tz` is required" }, { status: 422 });
  }

  // Persistir en Upstash Redis
  const saved = await setSchedule({ enabled, from, to, tz, updatedBy: user.username });

  // Disparar push FCM
  let fcmMessageId: string | null = null;
  let fcmError: string | null = null;
  try {
    fcmMessageId = await sendSchedulePush({ enabled, from, to, tz });
  } catch (err) {
    console.error("[FCM push failed]", err);
    fcmError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(
    { ...saved, fcmMessageId, fcmError },
    { status: fcmError ? 207 : 200 }
  );
}
