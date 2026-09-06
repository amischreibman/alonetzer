// One-time migration of the existing Base44 site into this server.
//
//   BASE44_APP_ID=... BASE44_API_KEY=... npm run import:base44 -w server
//
// Reads every entity listed in BASE44_ENTITY_MAP (Base44 name -> app type),
// maps the fields, downloads referenced files into ./data/uploads/base44
// and inserts the items with `legacy_id` so re-running is idempotent.
// Users are imported too (without passwords) and marked "pending" so they can
// reset their password from the app.
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { config, dbPath, uploadsDir } from "../config.js";
import { createUser, findByLegacyId, insertContent, openDb, getUserRowByEmail, updateContent } from "../db.js";
import { buildContentInput } from "../content.js";
import { entityByType, type ContentData, type ContentType } from "../../../shared/src/index.js";
import { randomUUID } from "node:crypto";

const appId = process.env.BASE44_APP_ID ?? "";
const apiKey = process.env.BASE44_API_KEY ?? "";
const serverUrl = (process.env.BASE44_SERVER_URL ?? "https://base44.app").replace(/\/$/, "");
const entityMap: Record<string, ContentType> = JSON.parse(
  process.env.BASE44_ENTITY_MAP ?? '{"Article":"article","Flash":"flash","Event":"event","Greeting":"greeting","Issue":"issue"}',
);
const dryRun = process.argv.includes("--dry-run");

if (!appId || !apiKey) {
  console.error("Set BASE44_APP_ID and BASE44_API_KEY (Base44 dashboard -> Settings -> API key)");
  process.exit(1);
}

type Row = Record<string, unknown> & { id: string; created_date?: string };

async function base44Get<T>(pathname: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${serverUrl}/api${pathname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { api_key: apiKey, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url.pathname}: ${await res.text()}`);
  return (await res.json()) as T;
}

async function fetchAll(entity: string): Promise<Row[]> {
  const out: Row[] = [];
  const pageSize = 100;
  for (let skip = 0; ; skip += pageSize) {
    const page = await base44Get<Row[]>(`/apps/${appId}/entities/${entity}`, { sort: "-created_date", limit: String(pageSize), skip: String(skip) });
    out.push(...page);
    if (page.length < pageSize) break;
  }
  return out;
}

/** Copy a remote file into the uploads folder and return its public URL. */
async function localizeFile(url: unknown): Promise<string | null> {
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) return null;
  const dir = path.join(uploadsDir, "base44");
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(new URL(url).pathname) || "";
  const name = `${randomUUID()}${ext}`;
  if (dryRun) return url;
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(String(res.status));
    await pipeline(Readable.fromWeb(res.body as never), fs.createWriteStream(path.join(dir, name)));
    return `${config.publicUrl}/uploads/base44/${name}`;
  } catch (err) {
    console.warn(`  ! could not download ${url}: ${(err as Error).message}; keeping remote URL`);
    return url;
  }
}

/** Best-effort field mapping: same names first, then common Base44 aliases. */
const ALIASES: Record<string, string[]> = {
  title: ["title", "name", "headline", "subject"],
  subtitle: ["subtitle", "sub_title", "summary"],
  content: ["content", "body", "text", "html"],
  message: ["message", "content", "text", "body"],
  description: ["description", "content", "details", "body"],
  author: ["author", "writer", "by"],
  section: ["section", "category", "department"],
  image_url: ["image_url", "image", "cover_image", "main_image", "photo"],
  cover_url: ["cover_url", "cover_image", "image_url", "image", "thumbnail"],
  pdf_url: ["pdf_url", "file_url", "pdf", "file"],
  publish_date: ["publish_date", "published_at", "date", "created_date"],
  date: ["date", "publish_date", "created_date"],
  start_date: ["start_date", "date", "start", "event_date"],
  end_date: ["end_date", "end"],
  location: ["location", "place", "venue"],
  link: ["link", "url"],
  visibility: ["visibility", "audience", "access"],
  pinned: ["pinned", "is_pinned", "featured"],
  published: ["published", "is_published", "status"],
  number: ["number", "issue_number", "issue"],
  kind: ["kind", "type"],
  phone: ["phone", "mobile"],
};

const SECTION_MAP: Record<string, string> = {
  הנהלה: "management",
  management: "management",
  קהילה: "community",
  community: "community",
  במה: "stage",
  stage: "stage",
  ורודים: "pinks",
  וורודים: "pinks",
  pinks: "pinks",
};

function pick(row: Row, field: string): unknown {
  for (const alias of ALIASES[field] ?? [field]) if (row[alias] !== undefined && row[alias] !== null && row[alias] !== "") return row[alias];
  return undefined;
}

function mapRow(type: ContentType, row: Row): ContentData {
  const def = entityByType(type)!;
  const data: ContentData = {};
  for (const f of def.fields) {
    let v = pick(row, f.name);
    if (f.name === "section" && v !== undefined) v = SECTION_MAP[String(v).trim()] ?? v;
    if (f.name === "published") v = v === undefined ? true : v === true || v === "published" || v === "true";
    if (f.name === "visibility" && typeof v === "string") {
      const s = v.toLowerCase();
      v = s.includes("member") || s.includes("חבר") ? "members" : s.includes("resident") || s.includes("תושב") ? "residents" : "public";
    }
    if (v !== undefined) data[f.name] = v;
  }
  return data;
}

async function run(): Promise<void> {
  const db = openDb(dbPath);
  console.log(`Importing from ${serverUrl} app ${appId}${dryRun ? " (dry run)" : ""}`);

  for (const [entityName, type] of Object.entries(entityMap)) {
    let rows: Row[];
    try {
      rows = await fetchAll(entityName);
    } catch (err) {
      console.warn(`- ${entityName}: skipped (${(err as Error).message})`);
      continue;
    }
    console.log(`- ${entityName} -> ${type}: ${rows.length} records`);
    let created = 0;
    let updated = 0;
    let failed = 0;
    for (const row of rows) {
      const data = mapRow(type, row);
      for (const key of ["image_url", "cover_url", "pdf_url"]) {
        if (data[key]) data[key] = (await localizeFile(data[key])) ?? data[key];
      }
      try {
        const input = buildContentInput(type, data);
        if (dryRun) {
          created++;
          continue;
        }
        const existing = findByLegacyId(db, type, row.id);
        if (existing) {
          updateContent(db, type, existing.id, input);
          updated++;
        } else {
          insertContent(db, { ...input, legacy_id: row.id, created_at: row.created_date });
          created++;
        }
      } catch (err) {
        failed++;
        console.warn(`  ! ${row.id}: ${(err as Error).message}`);
      }
    }
    console.log(`  created ${created}, updated ${updated}, failed ${failed}`);
  }

  // Users: Base44 exposes the app's users as the built-in "User" entity.
  try {
    const users = await fetchAll("User");
    console.log(`- User: ${users.length} records`);
    let created = 0;
    for (const u of users) {
      const email = String(u.email ?? "").toLowerCase();
      if (!email || getUserRowByEmail(db, email)) continue;
      if (dryRun) {
        created++;
        continue;
      }
      const membershipRaw = String(u.membership ?? u.member_type ?? u.status ?? "").toLowerCase();
      createUser(db, {
        email,
        // Random unusable password; the person resets it from the app.
        password_hash: `imported:${randomUUID()}`,
        full_name: String(u.full_name ?? u.name ?? ""),
        role: u.role === "admin" ? "admin" : "user",
        membership: membershipRaw.includes("member") || membershipRaw.includes("חבר") ? "member" : membershipRaw.includes("resident") || membershipRaw.includes("תושב") ? "resident" : "guest",
        status: "active",
        phone: (pick(u, "phone") as string | undefined) ?? null,
      });
      created++;
    }
    console.log(`  created ${created} users (they must use "שכחתי סיסמה" or get a password from an admin)`);
  } catch (err) {
    console.warn(`- User: skipped (${(err as Error).message})`);
  }
  console.log("done");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
