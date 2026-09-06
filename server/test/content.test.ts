import { test } from "node:test";
import assert from "node:assert/strict";
import { auth, createTestEnv } from "./helpers.js";

const article = (over: Record<string, unknown> = {}) => ({
  title: "פרוטוקול הנהלה",
  section: "management",
  content: "<p>תוכן הישיבה</p>",
  publish_date: "2026-09-01",
  visibility: "public",
  published: true,
  ...over,
});

test("editors create content, readers see published items only", async () => {
  const { app, adminToken, pushLog } = await createTestEnv();
  const anon = await app.inject({ method: "POST", url: "/api/content/article", payload: article() });
  assert.equal(anon.statusCode, 401);

  const created = await app.inject({ method: "POST", url: "/api/content/article", headers: auth(adminToken), payload: article() });
  assert.equal(created.statusCode, 201);
  const id = (created.json() as { item: { id: string } }).item.id;
  assert.equal(pushLog.length, 1, "a push is emitted for new published content");

  const draft = await app.inject({ method: "POST", url: "/api/content/article", headers: auth(adminToken), payload: article({ title: "טיוטה", published: false }) });
  assert.equal(draft.statusCode, 201);
  assert.equal(pushLog.length, 1, "drafts do not trigger pushes");

  const list = await app.inject({ method: "GET", url: "/api/content/article" });
  const items = (list.json() as { items: { id: string }[] }).items;
  assert.equal(items.length, 1);
  assert.equal(items[0].id, id);

  const all = await app.inject({ method: "GET", url: "/api/content/article?all=1", headers: auth(adminToken) });
  assert.equal((all.json() as { items: unknown[] }).items.length, 2);

  const invalid = await app.inject({ method: "POST", url: "/api/content/article", headers: auth(adminToken), payload: { title: "" } });
  assert.equal(invalid.statusCode, 400);
  assert.ok((invalid.json() as { errors: string[] }).errors.length >= 2);

  // Publishing a draft later notifies exactly once.
  const draftId = (draft.json() as { item: { id: string } }).item.id;
  await app.inject({ method: "PUT", url: `/api/content/article/${draftId}`, headers: auth(adminToken), payload: { published: true } });
  assert.equal(pushLog.length, 2);
  await app.inject({ method: "PUT", url: `/api/content/article/${draftId}`, headers: auth(adminToken), payload: { title: "טיוטה 2" } });
  assert.equal(pushLog.length, 2);

  const view = await app.inject({ method: "POST", url: `/api/content/article/${id}/view` });
  assert.equal(view.statusCode, 200);
  const one = await app.inject({ method: "GET", url: `/api/content/article/${id}` });
  assert.equal((one.json() as { item: { views: number } }).item.views, 1);

  const del = await app.inject({ method: "DELETE", url: `/api/content/article/${id}`, headers: auth(adminToken) });
  assert.equal(del.statusCode, 200);
});

test("visibility rules: members-only content hidden from guests and residents", async () => {
  const { app, adminToken, login } = await createTestEnv();
  await app.inject({ method: "POST", url: "/api/content/article", headers: auth(adminToken), payload: article({ title: "לחברים", visibility: "members" }) });
  await app.inject({ method: "POST", url: "/api/content/article", headers: auth(adminToken), payload: article({ title: "לתושבים", visibility: "residents" }) });
  await app.inject({ method: "POST", url: "/api/content/article", headers: auth(adminToken), payload: article({ title: "לכולם" }) });

  const mk = async (email: string, membership: string, status = "active") =>
    app.inject({ method: "POST", url: "/api/admin/users", headers: auth(adminToken), payload: { email, password: "pass1234", full_name: email, membership, status } });
  await mk("m@test.local", "member");
  await mk("r@test.local", "resident");
  await mk("p@test.local", "member", "pending");

  const titles = async (token?: string) => {
    const res = await app.inject({ method: "GET", url: "/api/content/article", headers: token ? auth(token) : {} });
    return (res.json() as { items: { data: { title: string } }[] }).items.map((i) => i.data.title).sort();
  };
  assert.deepEqual(await titles(), ["לכולם"]);
  assert.deepEqual(await titles(await login("r@test.local", "pass1234")), ["לכולם", "לתושבים"]);
  assert.deepEqual(await titles(await login("m@test.local", "pass1234")), ["לחברים", "לכולם", "לתושבים"]);
  assert.deepEqual(await titles(await login("p@test.local", "pass1234")), ["לכולם"], "pending users only see public content");
});

test("home bundle, search and event split", async () => {
  const { app, adminToken } = await createTestEnv();
  const soon = new Date(Date.now() + 86400_000).toISOString();
  const ago = new Date(Date.now() - 10 * 86400_000).toISOString();
  await app.inject({ method: "POST", url: "/api/content/event", headers: auth(adminToken), payload: { title: "ערב שירה", start_date: soon, published: true } });
  await app.inject({ method: "POST", url: "/api/content/event", headers: auth(adminToken), payload: { title: "טיול", start_date: ago, published: true } });
  await app.inject({ method: "POST", url: "/api/content/flash", headers: auth(adminToken), payload: { title: "הפסקת מים", content: "מחר בבוקר", date: soon, published: true } });
  await app.inject({ method: "POST", url: "/api/content/article", headers: auth(adminToken), payload: article({ title: "הכירו את ההנהלה" }) });

  const home = (await app.inject({ method: "GET", url: "/api/home" })).json() as { events: unknown[]; flashes: unknown[]; articles: unknown[] };
  assert.equal(home.events.length, 1);
  assert.equal(home.flashes.length, 1);
  assert.equal(home.articles.length, 1);

  const upcoming = (await app.inject({ method: "GET", url: "/api/content/event?upcoming=1" })).json() as { items: { data: { title: string } }[] };
  assert.deepEqual(upcoming.items.map((i) => i.data.title), ["ערב שירה"]);
  const past = (await app.inject({ method: "GET", url: "/api/content/event?past=1" })).json() as { items: { data: { title: string } }[] };
  assert.deepEqual(past.items.map((i) => i.data.title), ["טיול"]);

  const search = (await app.inject({ method: "GET", url: "/api/search?q=הנהלה" })).json() as { items: { type: string }[] };
  assert.equal(search.items.length, 1);
  assert.equal(search.items[0].type, "article");
});
