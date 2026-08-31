#!/usr/bin/env node
/**
 * Phase 3b — make per-station config uniqueness per-station.
 *
 * Three collections had a GLOBALLY unique field that needed to become
 * per-station:
 *
 *   SYMXSettings       key
 *   symxcardconfigs    page
 *   SymxAvailableWeeks week
 *
 * That makes per-station configuration impossible. DXC8 cannot have its
 * own system_timezone setting if DFO2 already used that key. It also
 * means the config clone in migration 06 fails with a duplicate key
 * error, leaving the new station with none — which is very likely what
 * happened when 06 was run.
 *
 * SymxAvailableWeeks was missed the first time this migration was written
 * — it's not part of the migration-06 config clone, so it didn't surface
 * until a second station tried to generate its first schedule week and
 * hit `E11000 ... week_1` on a week DFO2 had already touched (i.e. nearly
 * any real calendar week).
 *
 * SYMXRouteTypes is DELIBERATELY ABSENT. It was in this list originally,
 * but migration 10 later reclassified route types as a SHARED, org-wide
 * catalogue — one "Route 1" means the same thing at every station, with
 * per-station rates living in each type's `stations[]` array — and
 * restored its global unique index on `name` to match. This migration's
 * collection list was never updated after that reclassification, so
 * re-running it today would have silently undone migration 10's fix and
 * broken every org-wide route-type lookup by name. Caught before it ran,
 * not after.
 *
 * The schemas now declare { siteId, field } unique instead. Mongo does NOT
 * replace an index when the schema changes, so the old global one has to
 * be dropped explicitly or it keeps rejecting the inserts.
 *
 * Safe to re-run: skips anything already in the desired state.
 *
 * Usage:
 *   node scripts/migrate/07-per-station-unique-indexes.mjs --dry-run
 *   node scripts/migrate/07-per-station-unique-indexes.mjs
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "07-per-station-unique-indexes" });

// SYMXWSTOptions is deliberately absent. The WST catalogue is SHARED
// across stations — the same selections everywhere, priced per station via
// an embedded rates array — so its global unique index on `wst` is correct
// and must stay.
const COLLECTIONS = [
  { name: "SYMXSettings", field: "key" },
  { name: "symxcardconfigs", field: "page" },
  { name: "SymxAvailableWeeks", field: "week" },
];

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));

  let changed = 0;

  for (const { name, field } of COLLECTIONS) {
    if (!existing.has(name)) {
      console.log(`  ${name.padEnd(20)} not present`);
      continue;
    }
    const col = db.collection(name);
    const indexes = await col.indexes();

    // The old global unique index: exactly one key, on the field, unique.
    const globalUnique = indexes.find(
      (i) =>
        i.unique &&
        Object.keys(i.key).length === 1 &&
        Object.keys(i.key)[0] === field
    );
    const compound = indexes.find(
      (i) =>
        i.unique &&
        Object.keys(i.key).length === 2 &&
        Object.keys(i.key)[0] === "siteId" &&
        Object.keys(i.key)[1] === field
    );

    // ── Check for collisions BEFORE creating the new index ──
    // A duplicate within one station would make the compound index fail to
    // build, and the error message would point at the index rather than at
    // the data. Report the actual conflicting rows instead.
    const dupes = await col
      .aggregate([
        { $group: { _id: { siteId: "$siteId", v: `$${field}` }, n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } },
      ])
      .toArray();

    if (dupes.length > 0) {
      console.log(`\n  ⚠ ${name}: ${dupes.length} duplicate ${field} value(s) WITHIN a station:`);
      for (const d of dupes.slice(0, 10)) {
        console.log(`      siteId=${d._id.siteId} ${field}="${d._id.v}" ×${d.n}`);
      }
      console.log(`    Resolve these before the unique index can be built.\n`);
      process.exitCode = 1;
      continue;
    }

    const actions = [];
    if (globalUnique) actions.push(`drop ${globalUnique.name}`);
    if (!compound) actions.push(`create {siteId,${field}} unique`);

    if (actions.length === 0) {
      console.log(`  ${name.padEnd(20)} already per-station`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  ${name.padEnd(20)} would ${actions.join(" + ")}`);
      continue;
    }

    // Create the new index BEFORE dropping the old one, so the collection is
    // never briefly unprotected against duplicates.
    if (!compound) {
      await col.createIndex({ siteId: 1, [field]: 1 }, { unique: true });
    }
    if (globalUnique) {
      await col.dropIndex(globalUnique.name);
    }
    console.log(`  ${name.padEnd(20)} ${actions.join(" + ")} ✓`);
    changed++;
  }

  console.log(
    DRY_RUN
      ? "\n--dry-run set — no indexes changed."
      : `\n✓ ${changed} collection(s) updated.\n\n` +
        "  Re-run migration 06 now if the config clone failed earlier:\n" +
        "    node scripts/migrate/06-reclassify-and-seed-station-config.mjs"
  );

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
