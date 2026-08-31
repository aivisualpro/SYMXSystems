#!/usr/bin/env node
/**
 * Phase 3e — merge and remove the string-siteId "twin" duplicates that
 * migration 13 found but wouldn't touch.
 *
 * Migration 13 found 285 SYMXRoutes documents with a string-typed siteId;
 * 283 of them have an ObjectId-typed TWIN for the same transporterId+date
 * — meaning the app has been reading and displaying the ObjectId twin all
 * along (Mongoose casts siteId queries to ObjectId), while the
 * string-typed twin was a phantom created every time Regenerate ran for
 * a driver who already had a route: the buggy string-filtered upsert
 * never matched the real document, so it inserted another one instead of
 * updating it.
 *
 * Which twin is safe to delete is NOT automatic, though. The Efficiency
 * screen only ever reads/writes the ObjectId twin (that's the only one
 * GET /api/dispatching/routes can return), so all manually-entered data
 * — actualDepartureTime, stopsRescued, etc. — is only ever on that one.
 * But the schedule-type-sync step in app/api/schedules/route.ts updates
 * a route by {transporterId, date} with NO siteId in its filter, so once
 * a phantom twin existed, a later schedule edit could have landed on
 * EITHER twin — meaning the phantom might actually hold a more recent
 * typeId/scheduleId/weekDay/yearWeek/van than the "real" one dispatchers
 * have been looking at.
 *
 * So for each pair:
 *   1. The ObjectId twin is always KEPT (it's the one with manual data).
 *   2. Whichever twin has the more recent updatedAt wins on the
 *      schedule-linkage fields only (typeId, scheduleId, weekDay,
 *      yearWeek, van) — merged onto the kept document if it's the phantom
 *      that's newer. Manually-entered fields on the kept document are
 *      never touched.
 *   3. The string-typed phantom is deleted.
 *
 * Usage:
 *   node scripts/migrate/14-merge-siteid-twin-duplicates.mjs --dry-run
 *   node scripts/migrate/14-merge-siteid-twin-duplicates.mjs --target=production --i-know-this-is-production
 */
import { MongoClient, ObjectId } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "14-merge-siteid-twin-duplicates" });

const LINKAGE_FIELDS = ["typeId", "scheduleId", "weekDay", "yearWeek", "van"];

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();
  const col = db.collection("SYMXRoutes");

  const phantoms = await col.find({ siteId: { $type: "string" } }).toArray();
  console.log(`  Found ${phantoms.length} string-typed siteId document(s).`);

  let noTwin = 0;
  let identical = 0;
  let merged = 0;
  let keptAsIs = 0;

  for (const phantom of phantoms) {
    let objId;
    try {
      objId = new ObjectId(phantom.siteId);
    } catch {
      console.log(`  ⚠ _id=${phantom._id}: siteId "${phantom.siteId}" is not a valid ObjectId — skipping, needs manual look.`);
      continue;
    }

    const real = await col.findOne({
      _id: { $ne: phantom._id },
      transporterId: phantom.transporterId,
      date: phantom.date,
      siteId: objId,
    });

    if (!real) {
      noTwin++;
      console.log(`  ⚠ _id=${phantom._id} (transporterId=${phantom.transporterId}, date=${phantom.date}): no ObjectId twin — this is a genuinely orphaned string-siteId route, not a duplicate. Run migration 13 for this one instead of this script.`);
      continue;
    }

    const diffs = LINKAGE_FIELDS.filter((f) => String(phantom[f] ?? "") !== String(real[f] ?? ""));
    const phantomNewer = new Date(phantom.updatedAt || 0) > new Date(real.updatedAt || 0);

    if (diffs.length === 0) {
      identical++;
      if (!DRY_RUN) {
        await col.deleteOne({ _id: phantom._id });
      }
      continue;
    }

    if (phantomNewer) {
      merged++;
      const setOps = {};
      for (const f of diffs) setOps[f] = phantom[f];
      console.log(`  ${DRY_RUN ? "Would merge" : "Merging"} ${diffs.join(", ")} from phantom ${phantom._id} → real ${real._id} (transporterId=${phantom.transporterId}, date=${new Date(phantom.date).toISOString().slice(0, 10)}, phantom is newer: ${phantom.updatedAt} > ${real.updatedAt})`);
      for (const f of diffs) {
        console.log(`      ${f}: "${real[f] ?? ""}" → "${phantom[f] ?? ""}"`);
      }
      if (!DRY_RUN) {
        await col.updateOne({ _id: real._id }, { $set: setOps });
        await col.deleteOne({ _id: phantom._id });
      }
    } else {
      keptAsIs++;
      console.log(`  Real doc ${real._id} is already newer or equal — discarding phantom ${phantom._id} as-is (transporterId=${phantom.transporterId}, date=${new Date(phantom.date).toISOString().slice(0, 10)}).`);
      if (!DRY_RUN) {
        await col.deleteOne({ _id: phantom._id });
      }
    }
  }

  console.log(`\n  Summary: ${identical} identical (deleted), ${merged} merged (phantom was newer), ${keptAsIs} discarded as-is (real was newer/equal), ${noTwin} orphaned (no twin — untouched).`);
  console.log(DRY_RUN ? "\n--dry-run set — no documents changed." : "\n✓ Done.");

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
