#!/usr/bin/env node
/**
 * Multi-site Phase 2 (Write-Ups slice) — stamp siteId on existing records.
 *
 * Every write-up and verbal coaching in the system today belongs to DFO2,
 * so each gets siteId = the default station. Records keep that ownership
 * permanently: if the employee later transfers to DXC8, their DFO2-era
 * discipline stays owned by DFO2, because that's where it happened.
 *
 * Idempotent and resumable — only touches documents with no siteId, so an
 * interrupted run can simply be re-run.
 *
 * Usage:
 *   node scripts/migrate/04-backfill-writeup-site-id.mjs --dry-run
 *   node scripts/migrate/04-backfill-writeup-site-id.mjs
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

const env = loadEnv(rootDir);
const { uri: TARGET_URI } = resolveTargetDb(env, { scriptName: "04-backfill-writeup-site-id" });

const COLLECTIONS = ["SYMXWriteups", "SYMXVerbalCoachings"];

async function main() {
  const mongo = new MongoClient(TARGET_URI);
  await mongo.connect();
  const db = mongo.db();

  const defaultSite = await db.collection("SYMXSites").findOne({ isDefault: true });
  if (!defaultSite) {
    throw new Error("No default station found. Run 01-seed-org-and-sites.mjs first.");
  }
  console.log(`Backfilling to: ${defaultSite.code} (${defaultSite._id})\n`);

  for (const name of COLLECTIONS) {
    const col = db.collection(name);
    const total = await col.countDocuments();
    const missing = await col.countDocuments({ siteId: { $exists: false } });
    const already = total - missing;

    console.log(`${name}`);
    console.log(`  total: ${total}   already stamped: ${already}   to backfill: ${missing}`);

    if (missing === 0) {
      console.log(`  nothing to do\n`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  would set siteId on ${missing} document(s)\n`);
      continue;
    }

    const res = await col.updateMany(
      { siteId: { $exists: false } },
      { $set: { siteId: defaultSite._id } }
    );
    console.log(`  updated: ${res.modifiedCount}`);

    const remaining = await col.countDocuments({ siteId: { $exists: false } });
    if (remaining > 0) {
      throw new Error(`POST-CONDITION FAILED: ${remaining} document(s) in ${name} still lack siteId.`);
    }
    console.log(`  ✓ all documents stamped\n`);
  }

  if (DRY_RUN) console.log("--dry-run set — no changes written.");
  else console.log("Done. Every write-up and coaching now has an owning station.");

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
