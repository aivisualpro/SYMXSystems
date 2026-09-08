#!/usr/bin/env node
/**
 * Make SYMXRoutesInfo's date+rowIndex uniqueness per-station.
 *
 * Same bug class as migration 12 (SYMXRoutes) and migration 15
 * (SYMXEmployeeSchedules): a GLOBALLY unique {date, rowIndex} index with
 * no siteId.
 *
 * Row numbering restarts at 0 for each station (see nextRowIndexBySite in
 * app/api/public/extension-sync/route.ts — "DXC8's first row is 0 even
 * when DFO2 already has 40"), and that route's upsert filter has always
 * included siteId. But the schema's unique index never did, so MongoDB
 * only allowed ONE document total for a given date+rowIndex, full stop —
 * the second station to sync a route for that date/row collided on the
 * index with a raw E11000, surfaced straight to whoever clicked
 * "Sync to SYMX" in the extension.
 *
 * The schema now declares {date, rowIndex, siteId} unique instead. Mongo
 * does NOT replace an index when the schema changes, so the old global
 * one has to be dropped explicitly or it keeps rejecting inserts.
 *
 * Safe to re-run: skips anything already in the desired state.
 *
 * Usage:
 *   node scripts/migrate/16-per-station-routesinfo-index.mjs --dry-run
 *   node scripts/migrate/16-per-station-routesinfo-index.mjs --target=production --i-know-this-is-production
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "16-per-station-routesinfo-index" });

const COLLECTION = "SYMXRoutesInfo";

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
      Object.keys(i.key)[0] === "date" &&
      Object.keys(i.key)[1] === "rowIndex"
  );
  const newCompound = indexes.find(
    (i) =>
      i.unique &&
      Object.keys(i.key).length === 3 &&
      Object.keys(i.key)[0] === "date" &&
      Object.keys(i.key)[1] === "rowIndex" &&
      Object.keys(i.key)[2] === "siteId"
  );

  // ── Check for TRUE duplicates within the same station first ──
  const dupesWithinStation = await col
    .aggregate([
      { $group: { _id: { date: "$date", rowIndex: "$rowIndex", siteId: "$siteId" }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();

  if (dupesWithinStation.length > 0) {
    console.log(`\n  ⚠ ${dupesWithinStation.length} duplicate date+rowIndex WITHIN the same station:`);
    for (const d of dupesWithinStation.slice(0, 10)) {
      console.log(`      siteId=${d._id.siteId} date=${d._id.date} rowIndex=${d._id.rowIndex} ×${d.n}`);
    }
    console.log(`    Resolve these (merge or delete extras) before the new index can be built.\n`);
    process.exitCode = 1;
    await mongo.close();
    return;
  }

  // ── Informational: date+rowIndex pairs that already span multiple stations ──
  const crossStation = await col
    .aggregate([
      { $group: { _id: { date: "$date", rowIndex: "$rowIndex" }, sites: { $addToSet: "$siteId" } } },
      { $match: { "sites.1": { $exists: true } } },
    ])
    .toArray();
  if (crossStation.length > 0) {
    console.log(`  ℹ ${crossStation.length} date+rowIndex pair(s) already span multiple stations (expected once this index is compound).`);
  }

  const actions = [];
  if (oldGlobal) actions.push(`drop ${oldGlobal.name}`);
  if (!newCompound) actions.push(`create {date,rowIndex,siteId} unique`);

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
    await col.createIndex({ date: 1, rowIndex: 1, siteId: 1 }, { unique: true });
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
