import { test } from "node:test";
import assert from "node:assert/strict";
import { auth, createTestEnv } from "./helpers.js";
import { messageForContent, targetsForContent } from "../src/push.js";
import { listDevicesWithUsers } from "../src/db.js";
import type { ContentItem } from "../../shared/src/index.js";

test("device registration, preferences and targeting", async () => {
  const { app, db, adminToken, login } = await createTestEnv();
  await app.inject({ method: "POST", url: "/api/admin/users", headers: auth(adminToken), payload: { email: "m@test.local", password: "pass1234", full_name: "m", membership: "member", status: "active" } });
  const memberToken = await login("m@test.local", "pass1234");

  const guest = await app.inject({ method: "POST", url: "/api/devices", payload: { token: "guest-token-0001", platform: "android" } });
  assert.equal(guest.statusCode, 200);
  const member = await app.inject({ method: "POST", url: "/api/devices", headers: auth(memberToken), payload: { token: "member-token-0001", platform: "android" } });
  assert.equal(member.statusCode, 200);

  // Guest disables the "management" category.
  const prefs = await app.inject({
    method: "PUT",
    url: "/api/devices/guest-token-0001/prefs",
    payload: { prefs: { enabled: true, broadcasts: true, categories: { management: false } } },
  });
  assert.equal(prefs.statusCode, 200);
  assert.equal((prefs.json() as { device: { prefs: { categories: { management: boolean; flash: boolean } } } }).device.prefs.categories.management, false);

  const devices = listDevicesWithUsers(db);
  const publicManagement: ContentItem = { id: "a", type: "article", published: true, sort_date: "", section: "management", visibility: "public", views: 0, created_at: "", updated_at: "", data: { title: "x", section: "management" } };
  assert.deepEqual(targetsForContent(devices, publicManagement).map((d) => d.token), ["member-token-0001"]);

  const membersFlash: ContentItem = { ...publicManagement, type: "flash", section: null, visibility: "members", data: { title: "מבזק", content: "רק לחברים" } };
  assert.deepEqual(targetsForContent(devices, membersFlash).map((d) => d.token), ["member-token-0001"]);

  const publicFlash: ContentItem = { ...membersFlash, visibility: "public" };
  assert.deepEqual(targetsForContent(devices, publicFlash).map((d) => d.token).sort(), ["guest-token-0001", "member-token-0001"]);

  const msg = messageForContent(publicFlash);
  assert.equal(msg.title, "מבזק: מבזק");
  assert.equal(msg.data.kind, "content");
  assert.equal(msg.data.category, "flash");

  const del = await app.inject({ method: "DELETE", url: "/api/devices/guest-token-0001" });
  assert.equal(del.statusCode, 200);
  assert.equal(listDevicesWithUsers(db).length, 1);
});

test("manual broadcast requires an editor and is logged", async () => {
  const { app, adminToken, pushLog } = await createTestEnv();
  await app.inject({ method: "POST", url: "/api/devices", payload: { token: "guest-token-0002" } });
  const anon = await app.inject({ method: "POST", url: "/api/admin/notify", payload: { title: "x" } });
  assert.equal(anon.statusCode, 401);
  const res = await app.inject({ method: "POST", url: "/api/admin/notify", headers: auth(adminToken), payload: { title: "אסיפה הערב", body: "בחדר האוכל 20:00" } });
  assert.equal(res.statusCode, 200);
  assert.equal((res.json() as { result: { targets: number } }).result.targets, 1);
  assert.equal(pushLog.length, 1);
  const log = await app.inject({ method: "GET", url: "/api/admin/notifications", headers: auth(adminToken) });
  assert.equal((log.json() as { notifications: unknown[] }).notifications.length, 1);
  const stats = await app.inject({ method: "GET", url: "/api/admin/stats", headers: auth(adminToken) });
  assert.equal(stats.statusCode, 200);
});
