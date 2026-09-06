// Entry point: opens the database, creates the first admin if needed and
// starts the HTTP server.
import { buildApp } from "./app.js";
import { config, dbPath, uploadsDir } from "./config.js";
import { countUsers, createUser, openDb } from "./db.js";
import { hashPassword } from "./auth.js";
import { createFirebaseSender } from "./push.js";
import { createMailer } from "./mail.js";

async function main(): Promise<void> {
  const db = openDb(dbPath);
  if (countUsers(db) === 0) {
    if (config.admin.email && config.admin.password) {
      createUser(db, {
        email: config.admin.email,
        password_hash: await hashPassword(config.admin.password),
        full_name: config.admin.name,
        role: "admin",
        membership: "member",
        status: "active",
      });
      console.log(`[init] created first admin ${config.admin.email}`);
    } else {
      console.warn("[init] no users yet – set ADMIN_EMAIL/ADMIN_PASSWORD or run `npm run create-admin`");
    }
  }
  const [sender, mailer] = await Promise.all([createFirebaseSender(), createMailer()]);
  const app = await buildApp({ db, sender, mailer, uploadsDir, webDir: config.webDir, logger: true });
  await app.listen({ port: config.port, host: config.host });
  console.log(`[server] listening on ${config.host}:${config.port} (public: ${config.publicUrl})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
