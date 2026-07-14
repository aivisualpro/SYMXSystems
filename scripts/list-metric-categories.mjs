#!/usr/bin/env node
/**
 * Read-only diagnostic — lists every DropdownOption of type "metric"
 * (the real, freeform write-up category list used across the app),
 * straight from the database. Used to build an accurate mapping from
 * the seeded DEFAULT_CORRECTIVE_ACTION_TEMPLATES category labels
 * (which use prefixed/abbreviated names) to the real category strings.
 *
 * Usage:
 *   node scripts/list-metric-categories.mjs
 */
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const envFile = fs.readFileSync(path.join(rootDir, ".env"), "utf-8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([A-Z_]+)=["']?(.+?)["']?\s*$/);
  if (match) process.env[match[1]] = match[2];
}

async function main() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db();
  const col = db.collection("SYMXDropdownOptions");

  const docs = await col
    .find({ type: "metric" }, { projection: { description: 1, isActive: 1, sortOrder: 1 } })
    .sort({ sortOrder: 1, description: 1 })
    .toArray();

  console.log(`${docs.length} metric categories:\n`);
  for (const d of docs) {
    console.log(`- ${JSON.stringify(d.description)}${d.isActive === false ? " (inactive)" : ""}`);
  }

  await mongo.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
