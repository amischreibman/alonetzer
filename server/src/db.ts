// SQLite storage. One generic `content` table holds every content type
// (article, flash, event, greeting, issue) with the entity fields in a JSON
// column and the columns needed for filtering/sorting promoted alongside.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  ContentData,
  ContentItem,
  ContentType,
  User,
  Visibility,
} from "../../shared/src/index.js";
import { normalizePushPrefs, type PushPrefs } from "../../shared/src/index.js";

export type DB = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  membership TEXT NOT NULL DEFAULT 'guest',
  status TEXT NOT NULL DEFAULT 'pending',
  phone TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  device_info TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 1,
  sort_date TEXT NOT NULL,
  section TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  pinned INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  search_text TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  notified_at TEXT,
  legacy_id TEXT
);
CREATE INDEX IF NOT EXISTS content_type_date ON content(type, published, sort_date DESC);
CREATE INDEX IF NOT EXISTS content_section ON content(type, section);
CREATE UNIQUE INDEX IF NOT EXISTS content_legacy ON content(type, legacy_id);
CREATE TABLE IF NOT EXISTS devices (
  token TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  prefs TEXT NOT NULL,
  app_version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS devices_user ON devices(user_id);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  kind TEXT NOT NULL,
  content_type TEXT,
  content_id TEXT,
  url TEXT,
  target_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  created_by TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export function openDb(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

export const now = (): string => new Date().toISOString();
export const newId = (): string => randomUUID();

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

interface UserRow extends User {
  password_hash: string;
}

export function rowToUser(row: UserRow): User {
  const { password_hash: _ph, ...user } = row;
  void _ph;
  return user;
}

export function getUserById(db: DB, id: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export function getUserRowByEmail(db: DB, email: string): UserRow | null {
  return (db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase()) as UserRow | undefined) ?? null;
}

export function createUser(
  db: DB,
  u: { email: string; password_hash: string; full_name: string; role?: string; membership?: string; status?: string; phone?: string | null },
): User {
  const id = newId();
  const t = now();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, role, membership, status, phone, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, u.email.trim().toLowerCase(), u.password_hash, u.full_name.trim(), u.role ?? "user", u.membership ?? "guest", u.status ?? "pending", u.phone ?? null, t, t);
  return getUserById(db, id)!;
}

export function updateUser(db: DB, id: string, patch: Partial<UserRow>): User | null {
  const allowed = ["full_name", "role", "membership", "status", "phone", "password_hash", "last_login_at", "email"] as const;
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const k of allowed) {
    if (patch[k] !== undefined) {
      sets.push(`${k} = ?`);
      values.push(k === "email" ? String(patch[k]).trim().toLowerCase() : patch[k]);
    }
  }
  if (!sets.length) return getUserById(db, id);
  sets.push("updated_at = ?");
  values.push(now(), id);
  db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  return getUserById(db, id);
}

export function listUsers(db: DB): User[] {
  return (db.prepare("SELECT * FROM users ORDER BY created_at DESC").all() as UserRow[]).map(rowToUser);
}

export function deleteUser(db: DB, id: string): void {
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function countUsers(db: DB): number {
  return (db.prepare("SELECT COUNT(*) c FROM users").get() as { c: number }).c;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function createSession(db: DB, userId: string, days: number, deviceInfo?: string): string {
  const token = randomUUID() + randomUUID().replace(/-/g, "");
  const t = new Date();
  const exp = new Date(t.getTime() + days * 86400_000);
  db.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at, device_info) VALUES (?, ?, ?, ?, ?)").run(
    token,
    userId,
    t.toISOString(),
    exp.toISOString(),
    deviceInfo ?? null,
  );
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(t.toISOString(), userId);
  return token;
}

export function getUserBySession(db: DB, token: string): User | null {
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, now()) as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export function deleteSession(db: DB, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function deleteUserSessions(db: DB, userId: string): void {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function createPasswordReset(db: DB, userId: string): string {
  const token = randomUUID().replace(/-/g, "");
  const exp = new Date(Date.now() + 2 * 3600_000).toISOString();
  db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(userId);
  db.prepare("INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, exp);
  return token;
}

export function consumePasswordReset(db: DB, token: string): string | null {
  const row = db.prepare("SELECT user_id, expires_at FROM password_resets WHERE token = ?").get(token) as
    | { user_id: string; expires_at: string }
    | undefined;
  db.prepare("DELETE FROM password_resets WHERE token = ?").run(token);
  if (!row || row.expires_at < now()) return null;
  return row.user_id;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

interface ContentRow {
  id: string;
  type: ContentType;
  published: number;
  sort_date: string;
  section: string | null;
  visibility: Visibility;
  pinned: number;
  views: number;
  data: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  notified_at: string | null;
  legacy_id: string | null;
}

function rowToContent(row: ContentRow): ContentItem {
  return {
    id: row.id,
    type: row.type,
    published: row.published === 1,
    sort_date: row.sort_date,
    section: row.section,
    visibility: row.visibility,
    views: row.views,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    data: JSON.parse(row.data) as ContentData,
  };
}

export interface ContentQuery {
  type: ContentType;
  visibilities: Visibility[];
  includeUnpublished?: boolean;
  section?: string;
  search?: string;
  limit?: number;
  skip?: number;
  /** Ascending by sort_date (used for upcoming events). */
  ascending?: boolean;
  /** Only items with sort_date >= this ISO value. */
  since?: string;
  /** Only items with sort_date < this ISO value. */
  before?: string;
  pinnedFirst?: boolean;
}

export function queryContent(db: DB, q: ContentQuery): ContentItem[] {
  const where: string[] = ["type = ?"];
  const params: unknown[] = [q.type];
  if (!q.includeUnpublished) where.push("published = 1");
  if (q.visibilities.length) {
    where.push(`visibility IN (${q.visibilities.map(() => "?").join(",")})`);
    params.push(...q.visibilities);
  } else {
    where.push("0");
  }
  if (q.section) {
    where.push("section = ?");
    params.push(q.section);
  }
  if (q.search) {
    where.push("search_text LIKE ?");
    params.push(`%${q.search.toLowerCase()}%`);
  }
  if (q.since) {
    where.push("sort_date >= ?");
    params.push(q.since);
  }
  if (q.before) {
    where.push("sort_date < ?");
    params.push(q.before);
  }
  const order = `${q.pinnedFirst ? "pinned DESC, " : ""}sort_date ${q.ascending ? "ASC" : "DESC"}, created_at DESC`;
  const limit = Math.min(Math.max(q.limit ?? 50, 1), 500);
  const skip = Math.max(q.skip ?? 0, 0);
  const rows = db
    .prepare(`SELECT * FROM content WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, limit, skip) as ContentRow[];
  return rows.map(rowToContent);
}

export function getContent(db: DB, type: ContentType, id: string): ContentItem | null {
  const row = db.prepare("SELECT * FROM content WHERE type = ? AND id = ?").get(type, id) as ContentRow | undefined;
  return row ? rowToContent(row) : null;
}

export interface ContentInput {
  type: ContentType;
  data: ContentData;
  published: boolean;
  sort_date: string;
  section?: string | null;
  visibility: Visibility;
  pinned: boolean;
  search_text: string;
  created_by?: string | null;
  legacy_id?: string | null;
  created_at?: string;
}

export function insertContent(db: DB, c: ContentInput): ContentItem {
  const id = newId();
  const t = now();
  db.prepare(
    `INSERT INTO content (id, type, published, sort_date, section, visibility, pinned, views, search_text, data, created_at, updated_at, created_by, legacy_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    c.type,
    c.published ? 1 : 0,
    c.sort_date,
    c.section ?? null,
    c.visibility,
    c.pinned ? 1 : 0,
    c.search_text,
    JSON.stringify(c.data),
    c.created_at ?? t,
    t,
    c.created_by ?? null,
    c.legacy_id ?? null,
  );
  return getContent(db, c.type, id)!;
}

export function updateContent(db: DB, type: ContentType, id: string, c: Omit<ContentInput, "type" | "created_by" | "legacy_id" | "created_at">): ContentItem | null {
  db.prepare(
    `UPDATE content SET published = ?, sort_date = ?, section = ?, visibility = ?, pinned = ?, search_text = ?, data = ?, updated_at = ?
     WHERE type = ? AND id = ?`,
  ).run(c.published ? 1 : 0, c.sort_date, c.section ?? null, c.visibility, c.pinned ? 1 : 0, c.search_text, JSON.stringify(c.data), now(), type, id);
  return getContent(db, type, id);
}

export function deleteContent(db: DB, type: ContentType, id: string): boolean {
  return db.prepare("DELETE FROM content WHERE type = ? AND id = ?").run(type, id).changes > 0;
}

export function incrementViews(db: DB, type: ContentType, id: string): void {
  db.prepare("UPDATE content SET views = views + 1 WHERE type = ? AND id = ?").run(type, id);
}

export function findByLegacyId(db: DB, type: ContentType, legacyId: string): ContentItem | null {
  const row = db.prepare("SELECT * FROM content WHERE type = ? AND legacy_id = ?").get(type, legacyId) as ContentRow | undefined;
  return row ? rowToContent(row) : null;
}

export function markNotified(db: DB, id: string): void {
  db.prepare("UPDATE content SET notified_at = ? WHERE id = ?").run(now(), id);
}

export function wasNotified(db: DB, id: string): boolean {
  const row = db.prepare("SELECT notified_at FROM content WHERE id = ?").get(id) as { notified_at: string | null } | undefined;
  return Boolean(row?.notified_at);
}

export function contentStats(db: DB): Record<string, { total: number; published: number; views: number }> {
  const rows = db
    .prepare("SELECT type, COUNT(*) total, SUM(published) published, SUM(views) views FROM content GROUP BY type")
    .all() as { type: string; total: number; published: number; views: number }[];
  return Object.fromEntries(rows.map((r) => [r.type, { total: r.total, published: r.published ?? 0, views: r.views ?? 0 }]));
}

// ---------------------------------------------------------------------------
// Devices (push tokens)
// ---------------------------------------------------------------------------

export interface Device {
  token: string;
  user_id: string | null;
  platform: string;
  prefs: PushPrefs;
  app_version: string | null;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
}

interface DeviceRow extends Omit<Device, "prefs"> {
  prefs: string;
}

function rowToDevice(row: DeviceRow): Device {
  return { ...row, prefs: normalizePushPrefs(JSON.parse(row.prefs)) };
}

export function upsertDevice(
  db: DB,
  d: { token: string; user_id: string | null; platform?: string; prefs?: PushPrefs; app_version?: string | null },
): Device {
  const t = now();
  const existing = db.prepare("SELECT * FROM devices WHERE token = ?").get(d.token) as DeviceRow | undefined;
  const prefs = d.prefs ?? (existing ? normalizePushPrefs(JSON.parse(existing.prefs)) : normalizePushPrefs(undefined));
  if (existing) {
    db.prepare("UPDATE devices SET user_id = ?, platform = ?, prefs = ?, app_version = ?, updated_at = ?, last_seen_at = ? WHERE token = ?").run(
      d.user_id,
      d.platform ?? existing.platform,
      JSON.stringify(prefs),
      d.app_version ?? existing.app_version,
      t,
      t,
      d.token,
    );
  } else {
    db.prepare(
      "INSERT INTO devices (token, user_id, platform, prefs, app_version, created_at, updated_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(d.token, d.user_id, d.platform ?? "android", JSON.stringify(prefs), d.app_version ?? null, t, t, t);
  }
  return getDevice(db, d.token)!;
}

export function getDevice(db: DB, token: string): Device | null {
  const row = db.prepare("SELECT * FROM devices WHERE token = ?").get(token) as DeviceRow | undefined;
  return row ? rowToDevice(row) : null;
}

export function deleteDevice(db: DB, token: string): void {
  db.prepare("DELETE FROM devices WHERE token = ?").run(token);
}

export function deleteDevices(db: DB, tokens: string[]): void {
  const stmt = db.prepare("DELETE FROM devices WHERE token = ?");
  const run = db.transaction((list: string[]) => list.forEach((t) => stmt.run(t)));
  run(tokens);
}

/** All devices joined with their user (if any) so visibility rules can be applied. */
export function listDevicesWithUsers(db: DB): Array<Device & { user: User | null }> {
  const rows = db
    .prepare(
      `SELECT d.*, u.id AS u_id, u.email AS u_email, u.full_name AS u_full_name, u.role AS u_role, u.membership AS u_membership,
              u.status AS u_status, u.created_at AS u_created_at, u.updated_at AS u_updated_at
       FROM devices d LEFT JOIN users u ON u.id = d.user_id`,
    )
    .all() as Array<DeviceRow & Record<string, unknown>>;
  return rows.map((r) => {
    const device = rowToDevice(r);
    const user: User | null = r.u_id
      ? {
          id: String(r.u_id),
          email: String(r.u_email),
          full_name: String(r.u_full_name),
          role: r.u_role as User["role"],
          membership: r.u_membership as User["membership"],
          status: r.u_status as User["status"],
          created_at: String(r.u_created_at),
          updated_at: String(r.u_updated_at),
        }
      : null;
    return { ...device, user };
  });
}

export function countDevices(db: DB): number {
  return (db.prepare("SELECT COUNT(*) c FROM devices").get() as { c: number }).c;
}

// ---------------------------------------------------------------------------
// Notification log
// ---------------------------------------------------------------------------

export interface NotificationLog {
  id: string;
  title: string;
  body: string;
  category: string | null;
  kind: string;
  content_type: string | null;
  content_id: string | null;
  url: string | null;
  target_count: number;
  success_count: number;
  created_at: string;
  created_by: string | null;
}

export function logNotification(db: DB, n: Omit<NotificationLog, "id" | "created_at">): NotificationLog {
  const id = newId();
  const t = now();
  db.prepare(
    `INSERT INTO notifications (id, title, body, category, kind, content_type, content_id, url, target_count, success_count, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, n.title, n.body, n.category, n.kind, n.content_type, n.content_id, n.url, n.target_count, n.success_count, t, n.created_by);
  return { ...n, id, created_at: t };
}

export function listNotifications(db: DB, limit = 50): NotificationLog[] {
  return db.prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?").all(limit) as NotificationLog[];
}

// ---------------------------------------------------------------------------
// Settings (key/value)
// ---------------------------------------------------------------------------

export function getSetting(db: DB, key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(db: DB, key: string, value: string): void {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
