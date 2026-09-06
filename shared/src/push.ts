import type { PushCategory } from "./entities.js";

export const PUSH_CATEGORIES: { key: PushCategory; label: string; description: string }[] = [
  { key: "flash", label: "מבזקים", description: "הודעות קצרות ודחופות" },
  { key: "management", label: "הנהלה", description: "כתבות חדשות במדור הנהלה" },
  { key: "community", label: "קהילה", description: "כתבות חדשות במדור קהילה" },
  { key: "stage", label: "במה", description: "כתבות חדשות במדור במה" },
  { key: "pinks", label: "ורודים", description: "ברכות וימי הולדת" },
  { key: "event", label: "לוח אירועים", description: "אירועים חדשים בלוח" },
  { key: "issue", label: "גיליונות וארכיון", description: "גיליון מודפס חדש עלה לארכיון" },
];

/** Per-device notification preferences. */
export interface PushPrefs {
  enabled: boolean;
  categories: Record<PushCategory, boolean>;
  /** Also receive manual broadcasts sent by the editors. */
  broadcasts: boolean;
}

export function defaultPushPrefs(): PushPrefs {
  return {
    enabled: true,
    broadcasts: true,
    categories: Object.fromEntries(PUSH_CATEGORIES.map((c) => [c.key, true])) as Record<PushCategory, boolean>,
  };
}

export function normalizePushPrefs(input: unknown): PushPrefs {
  const base = defaultPushPrefs();
  if (!input || typeof input !== "object") return base;
  const o = input as Partial<PushPrefs>;
  if (typeof o.enabled === "boolean") base.enabled = o.enabled;
  if (typeof o.broadcasts === "boolean") base.broadcasts = o.broadcasts;
  if (o.categories && typeof o.categories === "object") {
    for (const c of PUSH_CATEGORIES) {
      const v = (o.categories as Record<string, unknown>)[c.key];
      if (typeof v === "boolean") base.categories[c.key] = v;
    }
  }
  return base;
}

/** Payload carried inside every push so the app can open the right screen. */
export interface PushData {
  kind: "content" | "broadcast";
  category?: PushCategory;
  type?: string;
  id?: string;
  url?: string;
}
