#!/usr/bin/env node
/**
 * Repair — clear siteId from the collections that are organization-level.
 *
 * Four collections were site-owned early on and later reclassified as
 * shared across the company:
 *
 *   vehiclesRentalAgreements   the contract is with the leasing company,
 *                              and one agreement can cover a van that
 *                              moves between stations
 *   messagingtemplates         the same wording is used everywhere
 *   SYMXWSTOptions             one catalogue, priced per station
 *   SYMXRouteTypes             one catalogue, timed per station
 *
 * Migration 05 kept its original list and so re-stamped them with the
 * default station whenever it was re-run, undoing 06/08/09/10 without
 * saying so. The effect is invisible until you switch stations: the
 * catalogues are simply empty at DXC8 and DFO3, which reads as "not
 * configured yet" rather than "silently reassigned".
 *
 * This clears siteId on those four and nothing else. Deliberately narrower
 * than re-running 08/09/10, which also rewrite rate tiers and per-station
 * start times — this repair should not be able to touch that data.
 *
 * Idempotent. Safe to run on a database that was never damaged.
 *
 * Usage:
 *   node scripts/migrate/11-repair-org-level-siteids.mjs --dry-run
 *   node scripts/migrate/11-repair-org-level-siteids.mjs
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

const ORG_LEVEL_COLLECTIONS = [
  "vehiclesRentalAgreements",
  "messagingtemplates",
  "SYMXWSTOptions",
  "SYMXRouteTypes",
];

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "11-repair-org-level-siteids" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();

  console.log("Clearing siteId from organization-level collections:\n");

  let total = 0;
  for (const name of ORG_LEVEL_COLLECTIONS) {
    const col = db.collection(name);

    // countDocuments rather than an existence check: a collection that is
    // absent entirely is fine (unused feature), and reports as 0 here.
    const stamped = await col.countDocuments({ siteId: { $exists: true } });
    const total_ = await col.countDocuments({});

    if (stamped === 0) {
      console.log(`  ${name.padEnd(28)} ${String(total_).padStart(6)} — already org-level`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  ${name.padEnd(28)} ${String(total_).padStart(6)} — would clear ${stamped}`);
    } else {
      const res = await col.updateMany(
        { siteId: { $exists: true } },
        { $unset: { siteId: "" } }
      );
      console.log(`  ${name.padEnd(28)} ${String(total_).padStart(6)} — cleared ${res.modifiedCount} ✓`);
    }
    total += stamped;
  }

  console.log(
    DRY_RUN
      ? `\nWould clear siteId on ${total} document(s).\n--dry-run set — nothing written.`
      : total === 0
      ? "\n✓ Nothing to repair — all four are already organization-level."
      : `\n✓ Cleared siteId on ${total} document(s).\n\n` +
        "  The shared catalogues are visible from every station again.\n" +
        "  Check Admin > Settings > WST and Default Routes at a non-default\n" +
        "  station to confirm."
  );

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
