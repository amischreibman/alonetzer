// Push delivery through Firebase Cloud Messaging. Without a service account
// the sender runs in "dry" mode and only logs, so the rest of the system
// (preferences, targeting, history) can be developed and tested offline.
import fs from "node:fs";
import type { ContentItem, PushCategory, PushData, User } from "../../shared/src/index.js";
import { canRead, entityByType, pushCategoryOf } from "../../shared/src/index.js";
import { config } from "./config.js";
import { deleteDevices, listDevicesWithUsers, logNotification, markNotified, type DB, type Device } from "./db.js";

export interface PushMessage {
  title: string;
  body: string;
  data: PushData;
  imageUrl?: string;
}

export interface SendResult {
  targets: number;
  success: number;
  failure: number;
  invalidTokens: string[];
}

export interface Sender {
  ready: boolean;
  send(tokens: string[], msg: PushMessage): Promise<SendResult>;
}

/** Dry sender: used in tests and when Firebase is not configured. */
export function createDrySender(log: (line: string) => void = console.log): Sender {
  return {
    ready: false,
    async send(tokens, msg) {
      log(`[push:dry] "${msg.title}" -> ${tokens.length} devices (${JSON.stringify(msg.data)})`);
      return { targets: tokens.length, success: 0, failure: 0, invalidTokens: [] };
    },
  };
}

export async function createFirebaseSender(): Promise<Sender> {
  const file = config.firebaseServiceAccount;
  if (!file || !fs.existsSync(file)) {
    console.warn(`[push] Firebase service account not found (${file || "unset"}); notifications will only be logged.`);
    return createDrySender();
  }
  const admin = await import("firebase-admin");
  const app = admin.default.initializeApp({
    credential: admin.default.credential.cert(JSON.parse(fs.readFileSync(file, "utf8"))),
  });
  const messaging = admin.default.messaging(app);
  return {
    ready: true,
    async send(tokens, msg) {
      const result: SendResult = { targets: tokens.length, success: 0, failure: 0, invalidTokens: [] };
      // FCM accepts at most 500 tokens per multicast call.
      for (let i = 0; i < tokens.length; i += 500) {
        const batch = tokens.slice(i, i + 500);
        const res = await messaging.sendEachForMulticast({
          tokens: batch,
          notification: { title: msg.title, body: msg.body, ...(msg.imageUrl ? { imageUrl: msg.imageUrl } : {}) },
          data: Object.fromEntries(Object.entries(msg.data).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])),
          android: {
            priority: "high",
            notification: { channelId: "alon_content", sound: "default", ...(msg.imageUrl ? { imageUrl: msg.imageUrl } : {}) },
          },
        });
        result.success += res.successCount;
        result.failure += res.failureCount;
        res.responses.forEach((r, idx) => {
          const code = r.error?.code ?? "";
          if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
            result.invalidTokens.push(batch[idx]);
          }
        });
      }
      return result;
    },
  };
}

// ---------------------------------------------------------------------------
// Targeting
// ---------------------------------------------------------------------------

type Target = Device & { user: User | null };

function wantsCategory(d: Target, category: PushCategory): boolean {
  return d.prefs.enabled && d.prefs.categories[category] !== false;
}

/** Devices that should hear about a new content item. */
export function targetsForContent(devices: Target[], item: ContentItem): Target[] {
  const def = entityByType(item.type);
  if (!def) return [];
  const category = pushCategoryOf(def, item.data);
  return devices.filter((d) => wantsCategory(d, category) && canRead(d.user, item.visibility));
}

/** Devices that should get a manual broadcast (optionally limited to a category). */
export function targetsForBroadcast(devices: Target[], category?: PushCategory | null, visibility: ContentItem["visibility"] = "public"): Target[] {
  return devices.filter((d) => {
    if (!d.prefs.enabled) return false;
    if (category) return wantsCategory(d, category) && canRead(d.user, visibility);
    return d.prefs.broadcasts && canRead(d.user, visibility);
  });
}

function absoluteUrl(url: unknown): string | undefined {
  if (typeof url !== "string" || !url) return undefined;
  return url.startsWith("http") ? url : `${config.publicUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function messageForContent(item: ContentItem): PushMessage {
  const def = entityByType(item.type)!;
  const category = pushCategoryOf(def, item.data);
  const title = String(item.data[def.titleField] ?? def.label);
  const bodyByType: Record<string, () => string> = {
    article: () => `כתבה חדשה במדור ${labelOfSection(item.data.section)}${item.data.author ? ` · ${item.data.author}` : ""}`,
    flash: () => plain(item.data.content, 120),
    event: () => `אירוע חדש בלוח${item.data.location ? ` · ${item.data.location}` : ""}`,
    greeting: () => plain(item.data.message, 120) || "ברכה חדשה במדור ורודים",
    issue: () => "גיליון חדש עלה לארכיון",
  };
  const prefix: Record<string, string> = { flash: "מבזק: ", article: "", event: "", greeting: "ורודים: ", issue: "גיליון חדש: " };
  return {
    title: `${prefix[item.type] ?? ""}${title}`,
    body: bodyByType[item.type]?.() ?? "",
    data: { kind: "content", category, type: item.type, id: item.id },
    imageUrl: absoluteUrl(item.data.image_url ?? item.data.cover_url),
  };
}

function labelOfSection(section: unknown): string {
  const map: Record<string, string> = { management: "הנהלה", community: "קהילה", stage: "במה", pinks: "ורודים" };
  return map[String(section)] ?? String(section ?? "");
}

function plain(v: unknown, max: number): string {
  const t = String(v ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

// ---------------------------------------------------------------------------
// High level operations
// ---------------------------------------------------------------------------

export async function notifyNewContent(db: DB, sender: Sender, item: ContentItem, actorId?: string | null): Promise<SendResult | null> {
  if (!item.published) return null;
  const targets = targetsForContent(listDevicesWithUsers(db), item);
  const msg = messageForContent(item);
  const result = await sender.send(
    targets.map((t) => t.token),
    msg,
  );
  if (result.invalidTokens.length) deleteDevices(db, result.invalidTokens);
  markNotified(db, item.id);
  logNotification(db, {
    title: msg.title,
    body: msg.body,
    category: msg.data.category ?? null,
    kind: "content",
    content_type: item.type,
    content_id: item.id,
    url: null,
    target_count: result.targets,
    success_count: result.success,
    created_by: actorId ?? null,
  });
  return result;
}

export async function sendBroadcast(
  db: DB,
  sender: Sender,
  input: { title: string; body: string; category?: PushCategory | null; url?: string | null; visibility?: ContentItem["visibility"] },
  actorId?: string | null,
): Promise<SendResult> {
  const targets = targetsForBroadcast(listDevicesWithUsers(db), input.category ?? null, input.visibility ?? "public");
  const msg: PushMessage = {
    title: input.title,
    body: input.body,
    data: { kind: "broadcast", category: input.category ?? undefined, url: input.url ?? undefined },
  };
  const result = await sender.send(
    targets.map((t) => t.token),
    msg,
  );
  if (result.invalidTokens.length) deleteDevices(db, result.invalidTokens);
  logNotification(db, {
    title: msg.title,
    body: msg.body,
    category: input.category ?? null,
    kind: "broadcast",
    content_type: null,
    content_id: null,
    url: input.url ?? null,
    target_count: result.targets,
    success_count: result.success,
    created_by: actorId ?? null,
  });
  return result;
}
