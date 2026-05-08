import { redis } from "@/lib/kv";

const EVENTS_KEY = "events:stream";
const MAX_EVENTS = 500;

export type EventType =
  | "app_opened"
  | "warning_shown"
  | "scan_detected"
  | "user_continued"
  | "user_cancelled"
  // Modo global (toggle en la app): eventos que NO son de SC Pack
  | "global_app_opened"
  | "global_clicked";

export interface EventRecord {
  id: string;
  type: EventType;
  timestamp: number;
  deviceId: string;
  inSchedule?: boolean;
  screenName?: string;
  keywords?: string[];
  // Solo en eventos global_*
  appPackage?: string;
  screenText?: string[];
}

export async function appendEvent(event: EventRecord): Promise<void> {
  const member = JSON.stringify(event);
  await redis.zadd(EVENTS_KEY, { score: event.timestamp, member });
  // Keep only the most recent MAX_EVENTS entries.
  await redis.zremrangebyrank(EVENTS_KEY, 0, -MAX_EVENTS - 1);
}

export async function getEventsSince(sinceMs: number): Promise<EventRecord[]> {
  // Upstash returns members ordered by score ascending. Use exclusive lower bound.
  const raw = await redis.zrange<string[]>(EVENTS_KEY, `(${sinceMs}`, "+inf", {
    byScore: true,
  });
  return raw
    .map((s) => {
      try {
        return typeof s === "string" ? (JSON.parse(s) as EventRecord) : (s as EventRecord);
      } catch {
        return null;
      }
    })
    .filter((e): e is EventRecord => e !== null);
}

export async function getRecentEvents(limit: number = 50): Promise<EventRecord[]> {
  const raw = await redis.zrange<string[]>(EVENTS_KEY, -limit, -1);
  return raw
    .map((s) => {
      try {
        return typeof s === "string" ? (JSON.parse(s) as EventRecord) : (s as EventRecord);
      } catch {
        return null;
      }
    })
    .filter((e): e is EventRecord => e !== null);
}
