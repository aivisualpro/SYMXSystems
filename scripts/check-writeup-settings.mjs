#!/usr/bin/env node
/**
 * Read-only diagnostic — prints exactly what's stored in the
 * SYMXWriteupSettings collection right now, straight from the database,
 * bypassing the app entirely. Use this to confirm whether a save from the
 * Write-Up Settings page actually persisted.
 *
 * Usage:
 *   node scripts/check-writeup-settings.mjs
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
  console.log(`Connecting to: ${process.env.MONGODB_URI?.replace(/:\/\/[^@]+@/, "://***:***@")}\n`);
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db();
  console.log(`Database: ${db.databaseName}\n`);
  const col = db.collection("SYMXWriteupSettings");

  const docs = await col.find({}).toArray();
  console.log(`${docs.length} document(s) in SYMXWriteupSettings:\n`);

  for (const doc of docs) {
    console.log("──────────────────────────────────────");
    console.log(`_id: ${doc._id}`);
    console.log(`updatedAt: ${doc.updatedAt}`);
    console.log(`updatedBy: ${doc.updatedBy}`);
    console.log(`lookbackDays: ${doc.lookbackDays}`);
    console.log(`defaultConsequences: ${JSON.stringify(doc.defaultConsequences)}`);
    console.log(`stackGroups: ${JSON.stringify(doc.stackGroups)}`);
    console.log(`correctiveActionTemplates (${(doc.correctiveActionTemplates || []).length}):`);
    for (const t of doc.correctiveActionTemplates || []) {
      console.log(`  - categoryLabel: ${JSON.stringify(t.categoryLabel)}`);
      console.log(`    planForImprovement: ${JSON.stringify(t.planForImprovement)}`);
      console.log(`    consequences: ${JSON.stringify(t.consequences)}`);
    }
  }
  console.log("──────────────────────────────────────");

  await mongo.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
