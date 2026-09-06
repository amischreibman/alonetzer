// Minimal HTTP client for the newsletter server with bearer-token auth.
import { Preferences } from "@capacitor/preferences";
import { getServerUrl } from "@/config";

const TOKEN_KEY = "alon.token";
let token: string | null = null;

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: string[],
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  return token;
}

export async function loadToken(): Promise<string | null> {
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  token = value || null;
  return token;
}

export async function setToken(value: string | null): Promise<void> {
  token = value;
  if (value) await Preferences.set({ key: TOKEN_KEY, value });
  else await Preferences.remove({ key: TOKEN_KEY });
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Multipart body (FormData) - sent as-is. */
  form?: FormData;
  timeoutMs?: number;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const base = getServerUrl();
  if (!base) throw new HttpError(0, "כתובת השרת לא מוגדרת. פתח את ההגדרות והזן את כתובת השרת.");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { method: opts.method ?? "GET", headers, body, signal: controller.signal });
  } catch (err) {
    throw new HttpError(0, (err as Error).name === "AbortError" ? "השרת לא הגיב בזמן" : "אין חיבור לשרת");
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const d = data as { error?: string; errors?: string[] } | null;
    throw new HttpError(res.status, d?.error ?? `שגיאה ${res.status}`, d?.errors);
  }
  return data as T;
}

export const get = <T>(path: string) => request<T>(path);
export const post = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body });
export const put = <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body });
export const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

export function errorMessage(err: unknown, fallback = "אירעה שגיאה"): string {
  if (err instanceof HttpError) return err.errors?.length ? err.errors.join("\n") : err.message;
  return (err as Error)?.message || fallback;
}

/** Resolve a possibly-relative upload path against the server URL. */
export function absoluteUrl(url: unknown): string {
  if (typeof url !== "string" || !url) return "";
  return /^https?:\/\//.test(url) ? url : `${getServerUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
}
