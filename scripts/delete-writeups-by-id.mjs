#!/usr/bin/env node
/**
 * Deletes specific Write-Up records by _id, bypassing the app's normal
 * "only draft write-ups can be deleted" rule (which stays fully intact in
 * app/api/writeups/[id]/route.ts for everyone else — this script is a
 * narrow, manual, one-off exception for known test data only).
 *
 * Two steps, on purpose — this never deletes based on a search query, only
 * exact _ids you've confirmed by eye first:
 *
 *   1. List mode (no args): prints every non-draft write-up (id, employee,
 *      category, status, createdAt) so you can pick out the test ones.
 *
 *        node scripts/delete-writeups-by-id.mjs
 *
 *   2. Delete mode: pass the exact _ids you want removed, comma-separated,
 *      plus --confirm. Without --confirm it just shows what WOULD be
 *      deleted.
 *
 *        node scripts/delete-writeups-by-id.mjs --ids=<id1>,<id2>,<id3>
 *        node scripts/delete-writeups-by-id.mjs --ids=<id1>,<id2>,<id3> --confirm
 */
import { MongoClient, ObjectId } from "mongodb";
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

const CONFIRM = process.argv.includes("--confirm");
const idsArg = process.argv.find((a) => a.startsWith("--ids="));
const ids = idsArg ? idsArg.replace("--ids=", "").split(",").map((s) => s.trim()).filter(Boolean) : [];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not found in .env");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const collection = db.collection("SYMXWriteups");

  if (ids.length === 0) {
    // ── LIST MODE ──
    const records = await collection
      .find({}, { projection: { employeeName: 1, categoryLabel: 1, status: 1, createdAt: 1, incidentDate: 1, isHistorical: 1 } })
      .sort({ createdAt: -1 })
      .toArray();

    console.log(`${records.length} write-up(s) total:\n`);
    records.forEach((r) => {
      console.log(
        ` - ${r._id}  |  ${r.employeeName || "?"}  |  ${r.categoryLabel || "?"}  |  status: ${r.status}${r.isHistorical ? " (historical)" : ""}  |  created: ${r.createdAt ? new Date(r.createdAt).toLocaleString() : "?"}`
      );
    });
    console.log("\nCopy the _id(s) of the test records you want gone, then run:");
    console.log("  node scripts/delete-writeups-by-id.mjs --ids=<id1>,<id2>,<id3>");
    await client.close();
    return;
  }

  // ── DELETE MODE ──
  let objectIds;
  try {
    objectIds = ids.map((id) => new ObjectId(id));
  } catch (e) {
    console.error(`Invalid _id in list: ${e.message}`);
    await client.close();
    process.exit(1);
  }

  const matches = await collection
    .find({ _id: { $in: objectIds } }, { projection: { employeeName: 1, categoryLabel: 1, status: 1, createdAt: 1 } })
    .toArray();

  if (matches.length !== ids.length) {
    console.warn(`Warning: found ${matches.length} of ${ids.length} requested _id(s). Double-check the list below.`);
  }

  console.log(`${matches.length} record(s) matched:\n`);
  matches.forEach((r) => {
    console.log(` - ${r._id}  |  ${r.employeeName || "?"}  |  ${r.categoryLabel || "?"}  |  status: ${r.status}`);
  });

  if (!CONFIRM) {
    console.log("\nDry run only — no records deleted.");
    console.log("Re-run with --confirm added to permanently delete exactly these records.");
    await client.close();
    return;
  }

  const result = await collection.deleteMany({ _id: { $in: objectIds } });
  console.log(`\nDeleted ${result.deletedCount} record(s) from SYMXWriteups.`);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
