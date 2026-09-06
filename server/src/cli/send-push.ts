// Usage: npm run send-push -w server -- "כותרת" "גוף ההודעה" [category]
import { dbPath } from "../config.js";
import { openDb } from "../db.js";
import { createFirebaseSender, sendBroadcast } from "../push.js";
import type { PushCategory } from "../../../shared/src/index.js";

const [title, body = "", category] = process.argv.slice(2);
if (!title) {
  console.error('Usage: npm run send-push -w server -- "title" "body" [category]');
  process.exit(1);
}
const db = openDb(dbPath);
const sender = await createFirebaseSender();
const result = await sendBroadcast(db, sender, { title, body, category: (category as PushCategory) || null });
console.log(result);
