import { test } from "node:test";
import assert from "node:assert/strict";
import { auth, createTestEnv } from "./helpers.js";

test("register -> pending user, login, me, logout", async () => {
  const { app } = await createTestEnv();
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "dana@test.local", password: "pass1234", full_name: "דנה" },
  });
  assert.equal(reg.statusCode, 200);
  const { token, user } = reg.json() as { token: string; user: { status: string; role: string } };
  assert.equal(user.status, "pending");
  assert.equal(user.role, "user");

  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: auth(token) });
  assert.equal(me.statusCode, 200);

  const dup = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "dana@test.local", password: "pass1234", full_name: "x" } });
  assert.equal(dup.statusCode, 409);

  const bad = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "dana@test.local", password: "wrong" } });
  assert.equal(bad.statusCode, 401);

  await app.inject({ method: "POST", url: "/api/auth/logout", headers: auth(token) });
  const after = await app.inject({ method: "GET", url: "/api/auth/me", headers: auth(token) });
  assert.equal(after.statusCode, 401);
});

test("password reset flow with token", async () => {
  const { app, db } = await createTestEnv();
  await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "u@test.local", password: "pass1234", full_name: "U" } });
  const forgot = await app.inject({ method: "POST", url: "/api/auth/forgot", payload: { email: "u@test.local" } });
  assert.equal(forgot.statusCode, 200);
  const row = db.prepare("SELECT token FROM password_resets").get() as { token: string };
  const reset = await app.inject({ method: "POST", url: "/api/auth/reset", payload: { token: row.token, password: "newpass99" } });
  assert.equal(reset.statusCode, 200);
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "u@test.local", password: "newpass99" } });
  assert.equal(login.statusCode, 200);
});

test("admin user management and self-protection", async () => {
  const { app, adminToken } = await createTestEnv();
  const created = await app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers: auth(adminToken),
    payload: { email: "member@test.local", password: "pass1234", full_name: "חבר", membership: "member", status: "active" },
  });
  assert.equal(created.statusCode, 201);
  const id = (created.json() as { user: { id: string } }).user.id;

  const upd = await app.inject({ method: "PUT", url: `/api/admin/users/${id}`, headers: auth(adminToken), payload: { role: "editor", status: "active" } });
  assert.equal(upd.statusCode, 200);
  assert.equal((upd.json() as { user: { role: string } }).user.role, "editor");

  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: auth(adminToken) });
  const adminId = (me.json() as { user: { id: string } }).user.id;
  const selfDemote = await app.inject({ method: "PUT", url: `/api/admin/users/${adminId}`, headers: auth(adminToken), payload: { role: "user" } });
  assert.equal(selfDemote.statusCode, 400);

  const list = await app.inject({ method: "GET", url: "/api/admin/users", headers: auth(adminToken) });
  assert.equal((list.json() as { users: unknown[] }).users.length, 2);

  const anon = await app.inject({ method: "GET", url: "/api/admin/users" });
  assert.equal(anon.statusCode, 401);
});
