#!/usr/bin/env node
/**
 * Phase 3d — repair SYMXRoutes documents whose siteId was stored as a
 * plain STRING instead of an ObjectId.
 *
 * generateRoutesForWeek's upsert (lib/route-generation.ts) goes through
 * the raw MongoDB driver, not the Mongoose model — so nothing there
 * auto-casts siteId to ObjectId the way SYMXRoute.find({siteId}) does.
 * It wrote the raw string parameter straight into $setOnInsert. Every
 * route CREATED that way (likely most routes generated since per-station
 * scoping was added) has a string-typed siteId.
 *
 * The consequence is silent and total: ObjectId("507f...") and the
 * equal-looking string "507f..." are different BSON values, so every
 * ordinary Mongoose read in the app (GET /api/dispatching/routes, the
 * Efficiency screen, etc. — all of which query via the Mongoose model,
 * which casts the query's siteId to ObjectId) never matched these
 * documents. No error anywhere — the route just never appeared. This
 * was discovered via Angel Torres's route for 2026-08-31: the document
 * existed in the database the whole time, just permanently invisible.
 *
 * This converts every string-typed siteId on SYMXRoutes to a real
 * ObjectId, in place. Checks for genuine collisions first (a string-typed
 * doc and an ObjectId-typed doc both existing for the same logical
 * transporterId+date+siteId) — those would violate the unique index once
 * converted, and are reported instead of silently merged/dropped.
 *
 * Safe to re-run: only touches documents where siteId is currently a
 * string.
 *
 * Usage:
 *   node scripts/migrate/13-fix-string-siteid-on-routes.mjs --dry-run
 *   node scripts/migrate/13-fix-string-siteid-on-routes.mjs --target=production --i-know-this-is-production
 */
import { MongoClient, ObjectId } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "13-fix-string-siteid-on-routes" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();
  const col = db.collection("SYMXRoutes");

  const stringSited = await col
    .find({ siteId: { $type: "string" } })
    .project({ transporterId: 1, date: 1, siteId: 1 })
    .toArray();

  console.log(`  Found ${stringSited.length} route(s) with a string-typed siteId.`);

  if (stringSited.length === 0) {
    console.log("  Nothing to do.");
    await mongo.close();
    return;
  }

  // ── Check for genuine collisions before converting ──
  // If a document already exists with the SAME transporterId+date+siteId
  // but siteId already stored as the real ObjectId, converting the
  // string-typed twin would collide on the unique index.
  const collisions = [];
  const safe = [];
  for (const doc of stringSited) {
    let objId;
    try {
      objId = new ObjectId(doc.siteId);
    } catch {
      collisions.push({ ...doc, reason: `siteId "${doc.siteId}" is not a valid ObjectId string` });
      continue;
    }
    const existingTwin = await col.findOne({
      _id: { $ne: doc._id },
      transporterId: doc.transporterId,
      date: doc.date,
      siteId: objId,
    });
    if (existingTwin) {
      collisions.push({ ...doc, reason: `an ObjectId-typed twin already exists (_id=${existingTwin._id})` });
    } else {
      safe.push({ ...doc, objId });
    }
  }

  if (collisions.length > 0) {
    console.log(`\n  ⚠ ${collisions.length} route(s) can't be auto-converted — real duplicates once siteId is fixed:`);
    for (const c of collisions.slice(0, 10)) {
      console.log(`      _id=${c._id} transporterId=${c.transporterId} date=${c.date} — ${c.reason}`);
    }
    console.log(`    These need manual review (likely: keep the ObjectId-typed doc, since it's the one queries have actually been reading; delete or archive the string-typed duplicate).\n`);
  }

  console.log(`  ${safe.length} route(s) safe to convert.`);

  if (DRY_RUN) {
    console.log("\n--dry-run set — no documents changed.");
    await mongo.close();
    return;
  }

  if (safe.length > 0) {
    const ops = safe.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { siteId: doc.objId } },
      },
    }));
    const result = await col.bulkWrite(ops, { ordered: false });
    console.log(`\n✓ Converted ${result.modifiedCount} route(s) from string siteId to ObjectId.`);
  }

  if (collisions.length > 0) {
    process.exitCode = 1;
  }

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
