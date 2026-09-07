#!/usr/bin/env node
/**
 * Make SYMXEmployeeSchedules' driver+day uniqueness per-station.
 *
 * Same bug class as migration 12 (SYMXRoutes) and migration 07
 * (SymxAvailableWeeks/SYMXEveryday/etc.): a GLOBALLY unique
 * {transporterId, date} index with no siteId.
 *
 * It surfaces specifically on employee station transfers: an employee
 * moved to a new station can still have FUTURE, untouched schedule rows
 * sitting at their OLD station — syncEmployeeSchedules deliberately never
 * rewrites history, and its own cleanup pass only queries the DESTINATION
 * station (see lib/scheduling/sync-employee-schedules.ts), so it can't see
 * or remove those old rows. When someone then generates a week at the new
 * station, the insert for that transporterId+date collides on this index
 * with the still-existing document at the old station — a raw E11000
 * surfaced straight to the person clicking "Generate".
 *
 * The schema now declares {transporterId, date, siteId} unique instead.
 * Mongo does NOT replace an index when the schema changes, so the old
 * global one has to be dropped explicitly or it keeps rejecting inserts.
 *
 * Safe to re-run: skips anything already in the desired state.
 *
 * Usage:
 *   node scripts/migrate/15-per-station-employee-schedule-index.mjs --dry-run
 *   node scripts/migrate/15-per-station-employee-schedule-index.mjs --target=production --i-know-this-is-production
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "15-per-station-employee-schedule-index" });

const COLLECTION = "SYMXEmployeeSchedules";

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));

  if (!existing.has(COLLECTION)) {
    console.log(`  ${COLLECTION} not present — nothing to do.`);
    await mongo.close();
    return;
  }

  const col = db.collection(COLLECTION);
  const indexes = await col.indexes();

  const oldGlobal = indexes.find(
    (i) =>
      i.unique &&
      Object.keys(i.key).length === 2 &&
      Object.keys(i.key)[0] === "transporterId" &&
      Object.keys(i.key)[1] === "date"
  );
  const newCompound = indexes.find(
    (i) =>
      i.unique &&
      Object.keys(i.key).length === 3 &&
      Object.keys(i.key)[0] === "transporterId" &&
      Object.keys(i.key)[1] === "date" &&
      Object.keys(i.key)[2] === "siteId"
  );

  // ── Check for TRUE duplicates within the same station first ──
  // These would make the new compound index fail to build.
  const dupesWithinStation = await col
    .aggregate([
      { $group: { _id: { transporterId: "$transporterId", date: "$date", siteId: "$siteId" }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();

  if (dupesWithinStation.length > 0) {
    console.log(`\n  ⚠ ${dupesWithinStation.length} duplicate transporterId+date WITHIN the same station:`);
    for (const d of dupesWithinStation.slice(0, 10)) {
      console.log(`      siteId=${d._id.siteId} transporterId=${d._id.transporterId} date=${d._id.date} ×${d.n}`);
    }
    console.log(`    Resolve these (merge or delete extras) before the new index can be built.\n`);
    process.exitCode = 1;
    await mongo.close();
    return;
  }

  // ── Informational: driver+date pairs that already span multiple stations ──
  // This is exactly what the old global index was blocking — e.g. an
  // employee's schedule rows still sitting at their old station after a
  // transfer, alongside newly generated rows at their new one.
  const crossStation = await col
    .aggregate([
      { $group: { _id: { transporterId: "$transporterId", date: "$date" }, sites: { $addToSet: "$siteId" } } },
      { $match: { "sites.1": { $exists: true } } },
    ])
    .toArray();
  if (crossStation.length > 0) {
    console.log(`  ℹ ${crossStation.length} driver+date pair(s) already span multiple stations (expected once this index is compound).`);
  }

  const actions = [];
  if (oldGlobal) actions.push(`drop ${oldGlobal.name}`);
  if (!newCompound) actions.push(`create {transporterId,date,siteId} unique`);

  if (actions.length === 0) {
    console.log(`  ${COLLECTION} already per-station.`);
    await mongo.close();
    return;
  }

  if (DRY_RUN) {
    console.log(`  ${COLLECTION} would ${actions.join(" + ")}`);
    await mongo.close();
    return;
  }

  // Create the new index BEFORE dropping the old one, so the collection is
  // never briefly unprotected against true duplicates.
  if (!newCompound) {
    await col.createIndex({ transporterId: 1, date: 1, siteId: 1 }, { unique: true });
  }
  if (oldGlobal) {
    await col.dropIndex(oldGlobal.name);
  }
  console.log(`  ${COLLECTION} ${actions.join(" + ")} ✓`);

  console.log(DRY_RUN ? "\n--dry-run set — no indexes changed." : "\n✓ Done.");
  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
