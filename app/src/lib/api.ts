// Content access layer with an offline cache: the network is always tried
// first (the newsletter must be fresh on every open) and the last good copy
// is shown when the server is unreachable.
import { Preferences } from "@capacitor/preferences";
import type { ContentItem, ContentType, User } from "@alon/shared";
import { get, post, put, del, request, HttpError } from "@/lib/http";

const CACHE_PREFIX = "alon.cache.";

export interface Loaded<T> {
  data: T;
  fromCache: boolean;
  error?: string;
}

async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<Loaded<T>> {
  try {
    const data = await fetcher();
    try {
      await Preferences.set({ key: CACHE_PREFIX + key, value: JSON.stringify(data) });
    } catch {
      /* ignore storage errors */
    }
    return { data, fromCache: false };
  } catch (err) {
    const { value } = await Preferences.get({ key: CACHE_PREFIX + key });
    if (value) {
      return { data: JSON.parse(value) as T, fromCache: true, error: err instanceof HttpError && err.status ? err.message : "אין חיבור לשרת – מוצג תוכן שמור" };
    }
    throw err;
  }
}

export async function clearCache(): Promise<void> {
  const { keys } = await Preferences.keys();
  await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX)).map((key) => Preferences.remove({ key })));
}

export interface HomeBundle {
  user: User | null;
  articles: ContentItem[];
  flashes: ContentItem[];
  events: ContentItem[];
  greetings: ContentItem[];
  issues: ContentItem[];
  generated_at: string;
}

const scope = (user: User | null) => user?.id ?? "anon";

export const loadHome = (user: User | null) => cached(`home.${scope(user)}`, () => get<HomeBundle>("/api/home"));

export const loadList = (type: ContentType, user: User | null, params: Record<string, string | number | undefined> = {}) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const q = qs.toString();
  return cached(`list.${type}.${q}.${scope(user)}`, async () => (await get<{ items: ContentItem[] }>(`/api/content/${type}${q ? `?${q}` : ""}`)).items);
};

export const loadItem = (type: ContentType, id: string, user: User | null) =>
  cached(`item.${type}.${id}.${scope(user)}`, async () => (await get<{ item: ContentItem }>(`/api/content/${type}/${id}`)).item);

export const search = async (term: string): Promise<ContentItem[]> => (await get<{ items: ContentItem[] }>(`/api/search?q=${encodeURIComponent(term)}`)).items;

export const trackView = (type: ContentType, id: string) => post(`/api/content/${type}/${id}/view`).catch(() => undefined);

// ---- Editing --------------------------------------------------------------

export const createItem = (type: ContentType, data: Record<string, unknown>, notify = true) =>
  post<{ item: ContentItem; push: { targets: number; success: number } | null }>(`/api/content/${type}`, { ...data, notify });

export const updateItem = (type: ContentType, id: string, data: Record<string, unknown>, notify = true) =>
  put<{ item: ContentItem; push: { targets: number; success: number } | null }>(`/api/content/${type}/${id}`, { ...data, notify });

export const deleteItem = (type: ContentType, id: string) => del<{ ok: boolean }>(`/api/content/${type}/${id}`);

export async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await request<{ url: string }>("/api/uploads", { method: "POST", form, timeoutMs: 120000 });
  return res.url;
}

// ---- Admin ----------------------------------------------------------------

export interface AdminStats {
  content: Record<string, { total: number; published: number; views: number }>;
  users: { total: number; pending: number; active: number };
  devices: number;
  push: "firebase" | "dry";
  notifications: NotificationLog[];
}

export interface NotificationLog {
  id: string;
  title: string;
  body: string;
  category: string | null;
  kind: string;
  target_count: number;
  success_count: number;
  created_at: string;
}

export const loadStats = () => get<AdminStats>("/api/admin/stats");
export const loadUsers = async () => (await get<{ users: User[] }>("/api/admin/users")).users;
export const updateUserAdmin = (id: string, patch: Record<string, unknown>) => put<{ user: User }>(`/api/admin/users/${id}`, patch);
export const createUserAdmin = (data: Record<string, unknown>) => post<{ user: User }>("/api/admin/users", data);
export const deleteUserAdmin = (id: string) => del<{ ok: boolean }>(`/api/admin/users/${id}`);
export const sendBroadcast = (data: { title: string; body: string; category?: string | null; url?: string | null; visibility?: string }) =>
  post<{ result: { targets: number; success: number; failure: number }; dry: boolean }>("/api/admin/notify", data);
export const loadNotifications = async () => (await get<{ notifications: NotificationLog[] }>("/api/admin/notifications")).notifications;
