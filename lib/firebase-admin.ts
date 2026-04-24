import * as admin from "firebase-admin";

let app: admin.app.App | undefined;

export function getFirebaseAdmin(): admin.app.App {
  if (app) return app;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON env var");

  const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return app;
}

/**
 * Envía un data message FCM al topic "schedule-updates".
 * Todos los valores deben ser strings (limitación de FCM data messages).
 */
export async function sendSchedulePush(params: {
  enabled: boolean;
  from: string;
  to: string;
  tz: string;
}): Promise<string> {
  const messaging = getFirebaseAdmin().messaging();

  const messageId = await messaging.send({
    topic: "schedule-updates",
    data: {
      type: "schedule_update",
      enabled: String(params.enabled),
      from: params.from,
      to: params.to,
      tz: params.tz,
    },
    android: {
      priority: "high",
    },
  });

  return messageId;
}
