import { Redis } from "@upstash/redis";

if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  throw new Error("Missing KV_REST_API_URL or KV_REST_API_TOKEN env vars");
}

export const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const SCHEDULE_KEY = "schedule:current";

export interface ScheduleRecord {
  enabled: boolean;
  from: string;
  to: string;
  tz: string;
  updatedAt: number;
  updatedBy: string;
}

export async function getSchedule(): Promise<ScheduleRecord | null> {
  return redis.get<ScheduleRecord>(SCHEDULE_KEY);
}

export async function setSchedule(data: Omit<ScheduleRecord, "updatedAt">): Promise<ScheduleRecord> {
  const record: ScheduleRecord = { ...data, updatedAt: Date.now() };
  await redis.set(SCHEDULE_KEY, record);
  return record;
}
