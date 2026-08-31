#!/usr/bin/env node
/**
 * Phase 3c — make SYMXRoutes' driver+day uniqueness per-station.
 *
 * SYMXRoutes had a GLOBALLY unique {transporterId, date} index — the same
 * bug class as migration 07 (SymxAvailableWeeks), just discovered later
 * because it only bites when a driver's transporterId+date collides
 * across TWO different stations, which is rarer than the config-key
 * collisions migration 07 fixed.
 *
 * generateRoutesForWeek has always filtered its upsert by
 * {transporterId, date, siteId} — deliberately, per the comment in that
 * file: a driver loaned to another station on a given date is meant to
 * get a SEPARATE route document scoped to that station, not share one
 * with their home station. But the schema's unique index never included
 * siteId, so MongoDB only allows ONE document total for a given
 * transporterId+date, full stop — any station whose filter doesn't match
 * an already-existing document (because it belongs to a different
 * siteId) gets treated as "insert new", and that insert collides on the
 * index with a raw E11000 surfaced straight to the dispatcher pressing
 * "Regenerate".
 *
 * The schema now declares {transporterId, date, siteId} unique instead.
 * Mongo does NOT replace an index when the schema changes, so the old
 * global one has to be dropped explicitly or it keeps rejecting inserts.
 *
 * Safe to re-run: skips anything already in the desired state.
 *
 * Usage:
 *   node scripts/migrate/12-per-station-route-index.mjs --dry-run
 *   node scripts/migrate/12-per-station-route-index.mjs --target=production --i-know-this-is-production
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "12-per-station-route-index" });

const COLLECTION = "SYMXRoutes";

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
  // These would make the new compound index fail to build, and the error
  // would point at the index rather than at the actual bad rows.
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

  // ── Informational: how many driver+date pairs span multiple stations ──
  // These are exactly the rows migration 07's bug class was blocking —
  // legitimate loaned-driver cases that couldn't get a second route doc.
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
