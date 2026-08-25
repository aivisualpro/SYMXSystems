#!/usr/bin/env node
/**
 * Move a sample of records to another station, so switching stations in
 * the UI visibly changes what you see.
 *
 * After the backfill every record belongs to DFO2, which means selecting
 * DXC8 correctly shows an empty list — right, but indistinguishable from
 * broken. This creates something to actually find there.
 *
 * Staging-only. Reassigning which station owns a disciplinary record is
 * falsifying history; it is a test fixture, not an operation.
 *
 * Usage:
 *   node scripts/staging/move-records-to-station.mjs DXC8 --writeups=20 --coachings=10
 *   node scripts/staging/move-records-to-station.mjs --status
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, hostFromUri, dbNameFromUri, looksNonProduction } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const env = loadEnv(rootDir);

const args = process.argv.slice(2);
const STATUS_ONLY = args.includes("--status");
const targetCode = (args.find((a) => !a.startsWith("--")) || "").toUpperCase();
const numArg = (flag, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${flag}=`));
  return hit ? parseInt(hit.split("=")[1], 10) : fallback;
};

async function main() {
  const uri = env.STAGING_MONGODB_URI;
  if (!uri) throw new Error("STAGING_MONGODB_URI is not set in .env");
  if (!looksNonProduction(uri)) {
    throw new Error(
      `Refusing to run: ${hostFromUri(uri)}/${dbNameFromUri(uri)} does not look like staging.\n` +
        `Reassigning record ownership is a test fixture, never a production operation.`
    );
  }

  const mongo = new MongoClient(uri);
  await mongo.connect();
  const db = mongo.db();
  const sites = await db.collection("SYMXSites").find({}).toArray();
  const siteById = new Map(sites.map((s) => [String(s._id), s.code]));

  const report = async () => {
    console.log("\nRecords per station:");
    for (const name of ["SYMXWriteups", "SYMXVerbalCoachings"]) {
      const rows = await db
        .collection(name)
        .aggregate([{ $group: { _id: "$siteId", n: { $sum: 1 } } }])
        .toArray();
      const parts = rows.map((r) => `${r._id ? siteById.get(String(r._id)) || "?" : "(unassigned)"}: ${r.n}`);
      console.log(`  ${name.padEnd(22)} ${parts.join("   ")}`);
    }
  };

  if (STATUS_ONLY) {
    await report();
    await mongo.close();
    return;
  }

  if (!targetCode) {
    throw new Error("Provide a target station code, e.g. DXC8 — or --status to just report.");
  }
  const target = sites.find((s) => s.code === targetCode);
  if (!target) {
    throw new Error(`No station "${targetCode}". Available: ${sites.map((s) => s.code).join(", ")}`);
  }
  if (target.isDefault) {
    throw new Error(`${targetCode} is the default station — records are already there.`);
  }

  const nWriteups = numArg("writeups", 20);
  const nCoachings = numArg("coachings", 10);

  console.log(`Moving records to ${targetCode}…\n`);

  for (const [name, count] of [["SYMXWriteups", nWriteups], ["SYMXVerbalCoachings", nCoachings]]) {
    if (count <= 0) continue;
    const col = db.collection(name);
    const docs = await col
      .find({ siteId: { $ne: target._id } }, { projection: { _id: 1 } })
      .limit(count)
      .toArray();
    if (docs.length === 0) {
      console.log(`  ${name}: nothing available to move`);
      continue;
    }
    const res = await col.updateMany(
      { _id: { $in: docs.map((d) => d._id) } },
      { $set: { siteId: target._id } }
    );
    console.log(`  ${name}: moved ${res.modifiedCount}`);
  }

  await report();
  console.log(
    `\nNow switch stations in the app header — DFO2 and ${targetCode} should show different records.`
  );

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
