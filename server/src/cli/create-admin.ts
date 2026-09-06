// Usage: npm run create-admin -w server -- <email> <password> [full name]
import { dbPath } from "../config.js";
import { createUser, getUserRowByEmail, openDb, updateUser } from "../db.js";
import { hashPassword } from "../auth.js";

const [email, password, ...nameParts] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: npm run create-admin -w server -- <email> <password> [full name]");
  process.exit(1);
}
const db = openDb(dbPath);
const hash = await hashPassword(password);
const existing = getUserRowByEmail(db, email);
if (existing) {
  updateUser(db, existing.id, { password_hash: hash, role: "admin", status: "active", membership: "member" });
  console.log(`updated ${email}: now an active admin with the new password`);
} else {
  createUser(db, { email, password_hash: hash, full_name: nameParts.join(" ") || "עורך העלון", role: "admin", membership: "member", status: "active" });
  console.log(`created admin ${email}`);
}
