import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

/**
 * Firebase Admin SDK, used server-side only to push safety-alert (and
 * later, other) notifications to the driver app's registered device
 * tokens. Credentials come from a Firebase service account, set as three
 * separate env vars rather than one JSON blob — Vercel's env var UI
 * doesn't handle multi-line JSON secrets cleanly, and three flat strings
 * are easy to verify are actually set.
 *
 * FIREBASE_PRIVATE_KEY as stored in Vercel has its newlines escaped
 * ("\n" as two literal characters) — has to be un-escaped back to real
 * newlines or the key fails to parse.
 */
let app: App | null = null;

function getFirebaseApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin isn't configured — missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY env vars."
    );
  }

  app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return app;
}

export interface SafetyAlertPushData {
  transporterId: string;
  driverName: string;
  typeDescription: string;
  subTypeDescription?: string;
  severityDescription: string;
  netradyneAlertId: string;
}

/**
 * Sends a data-only + notification FCM message for a safety alert.
 *
 * Both a `notification` block AND a `data` block are included on purpose:
 * the notification block is what lets Android/FCM actually wake a
 * killed/backgrounded app and show something even if the app's own code
 * never runs (Doze mode, battery optimization, app swiped away) — a
 * data-only message can be silently dropped or delayed in those states.
 * The data block carries the structured fields the app's foreground/
 * background handler uses to build the spoken TTS message and decide
 * which local notification channel/sound to use.
 *
 * Returns `{ ok: true }` or `{ ok: false, reason }` — never throws, so a
 * failed push (bad/expired token, misconfigured Firebase) doesn't break
 * the webhook request that's logging the alert regardless.
 */
export async function sendSafetyAlertPush(
  fcmToken: string,
  alert: SafetyAlertPushData
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const firebaseApp = getFirebaseApp();
    const title = `Safety Alert — ${alert.severityDescription}`;
    const body = alert.subTypeDescription
      ? `${alert.typeDescription}: ${alert.subTypeDescription}`
      : alert.typeDescription;

    await getMessaging(firebaseApp).send({
      token: fcmToken,
      notification: { title, body },
      data: {
        type: "safety_alert",
        transporterId: alert.transporterId,
        driverName: alert.driverName,
        typeDescription: alert.typeDescription,
        subTypeDescription: alert.subTypeDescription || "",
        severityDescription: alert.severityDescription,
        netradyneAlertId: alert.netradyneAlertId,
      },
      android: {
        priority: "high",
        notification: {
          channelId: "safety_alerts",
          sound: "default",
        },
      },
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "Unknown FCM send error" };
  }
}
