// Push notifications: registers the FCM token with the server, keeps the
// per-device preferences in sync and routes notification taps to screens.
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { PushNotifications, type PushNotificationSchema, type ActionPerformed } from "@capacitor/push-notifications";
import { defaultPushPrefs, normalizePushPrefs, type PushData, type PushPrefs } from "@alon/shared";
import { post, put, del } from "@/lib/http";

const TOKEN_KEY = "alon.push.token";
const PREFS_KEY = "alon.push.prefs";
const APP_VERSION = "1.0.0";

let currentToken: string | null = null;
let openHandler: ((data: PushData) => void) | null = null;
let foregroundHandler: ((n: PushNotificationSchema) => void) | null = null;

export function isPushSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("PushNotifications");
}

export async function getStoredPrefs(): Promise<PushPrefs> {
  const { value } = await Preferences.get({ key: PREFS_KEY });
  return value ? normalizePushPrefs(JSON.parse(value)) : defaultPushPrefs();
}

export async function getPushToken(): Promise<string | null> {
  if (currentToken) return currentToken;
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  currentToken = value || null;
  return currentToken;
}

export function onNotificationOpen(handler: (data: PushData) => void): void {
  openHandler = handler;
}

export function onForegroundNotification(handler: (n: PushNotificationSchema) => void): void {
  foregroundHandler = handler;
}

/** Ask permission, register with FCM and send the token to the server. */
export async function initPush(): Promise<"granted" | "denied" | "unsupported"> {
  if (!isPushSupported()) return "unsupported";
  let status = await PushNotifications.checkPermissions();
  if (status.receive === "prompt" || status.receive === "prompt-with-rationale") status = await PushNotifications.requestPermissions();
  if (status.receive !== "granted") return "denied";

  await PushNotifications.removeAllListeners();
  await PushNotifications.addListener("registration", async ({ value }) => {
    currentToken = value;
    await Preferences.set({ key: TOKEN_KEY, value });
    await syncDeviceUser();
  });
  await PushNotifications.addListener("registrationError", (err) => console.error("push registration error", err));
  await PushNotifications.addListener("pushNotificationReceived", (n) => foregroundHandler?.(n));
  await PushNotifications.addListener("pushNotificationActionPerformed", (action: ActionPerformed) => {
    openHandler?.(parseData(action.notification.data));
  });
  try {
    await PushNotifications.createChannel({
      id: "alon_content",
      name: "עדכוני העלון",
      description: "כתבות, מבזקים, אירועים וברכות",
      importance: 4,
      visibility: 1,
      vibration: true,
    });
  } catch {
    /* channels are Android only */
  }
  await PushNotifications.register();
  return "granted";
}

function parseData(raw: unknown): PushData {
  const d = (raw ?? {}) as Record<string, string>;
  return { kind: d.kind === "broadcast" ? "broadcast" : "content", category: d.category as PushData["category"], type: d.type, id: d.id, url: d.url };
}

/** Re-send the token with the current user (call after login/logout). */
export async function syncDeviceUser(): Promise<void> {
  const token = await getPushToken();
  if (!token) return;
  const prefs = await getStoredPrefs();
  try {
    await post("/api/devices", { token, platform: Capacitor.getPlatform(), prefs, app_version: APP_VERSION });
  } catch {
    /* retried on next app start */
  }
}

export async function savePrefs(prefs: PushPrefs): Promise<void> {
  await Preferences.set({ key: PREFS_KEY, value: JSON.stringify(prefs) });
  const token = await getPushToken();
  if (!token) return;
  try {
    await put(`/api/devices/${encodeURIComponent(token)}/prefs`, { prefs });
  } catch {
    // Fall back to a full registration (token unknown to the server yet).
    await syncDeviceUser();
  }
}

export async function unregisterDevice(): Promise<void> {
  const token = await getPushToken();
  if (!token) return;
  try {
    await del(`/api/devices/${encodeURIComponent(token)}`);
  } catch {
    /* ignore */
  }
}
