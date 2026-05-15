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
 * Envía un push FCM al topic "schedule-updates".
 *
 * Combina notification + data: la notification asegura entrega aunque la app
 * esté en background o force-stopped (Android la muestra en la tray usando el
 * canal "schedule_updates_channel"); el data llega a onMessageReceived cuando
 * la app está activa para refrescar el snapshot local.
 */
export async function sendSchedulePush(params: {
  enabled: boolean;
  from: string;
  to: string;
  tz: string;
}): Promise<string> {
  const messaging = getFirebaseAdmin().messaging();

  const title = "📢 Horario actualizado por supervisor";
  const body = params.enabled
    ? `Nuevo rango permitido: ${params.from} – ${params.to}`
    : "Restricción horaria desactivada";

  const messageId = await messaging.send({
    topic: "schedule-updates",
    notification: { title, body },
    data: {
      type: "schedule_update",
      enabled: String(params.enabled),
      timeFrom: params.from,
      timeTo: params.to,
      tz: params.tz,
    },
    android: {
      priority: "high",
      notification: {
        channelId: "schedule_updates_channel",
        defaultSound: true,
      },
    },
  });

  return messageId;
}
