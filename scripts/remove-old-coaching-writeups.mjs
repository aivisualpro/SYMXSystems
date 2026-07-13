#!/usr/bin/env node
/**
 * Removes all records from the legacy SYMXCoachingWriteUps collection
 * (the old Dispatching → Coaching & Writeups feature), now that it has
 * been replaced by the new Write-Ups module.
 *
 * Per Rohan: "old records can be removed" — this is a one-way delete.
 * Review the dry-run count before re-running with --confirm.
 *
 * Usage:
 *   node scripts/remove-old-coaching-writeups.mjs            (dry run — counts only)
 *   node scripts/remove-old-coaching-writeups.mjs --confirm  (actually deletes)
 */
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Load .env
const envFile = fs.readFileSync(path.join(rootDir, ".env"), "utf-8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([A-Z_]+)=["']?(.+?)["']?\s*$/);
  if (match) process.env[match[1]] = match[2];
}

const CONFIRM = process.argv.includes("--confirm");

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not found in .env");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const collection = db.collection("SYMXCoachingWriteUps");

  const count = await collection.countDocuments();
  console.log(`Found ${count} record(s) in SYMXCoachingWriteUps.`);

  if (count === 0) {
    console.log("Nothing to delete.");
    await client.close();
    return;
  }

  if (!CONFIRM) {
    console.log("\nDry run only — no records deleted.");
    console.log("Re-run with --confirm to permanently delete these records:");
    console.log("  node scripts/remove-old-coaching-writeups.mjs --confirm");
    await client.close();
    return;
  }

  const result = await collection.deleteMany({});
  console.log(`Deleted ${result.deletedCount} record(s) from SYMXCoachingWriteUps.`);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
