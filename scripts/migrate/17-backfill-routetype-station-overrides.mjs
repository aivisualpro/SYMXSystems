#!/usr/bin/env node
/**
 * One-time backfill for the "Default Routes start times are actually
 * per-station now" change.
 *
 * Before this change, RouteType.startTime was a single SHARED field —
 * every station read and wrote the exact same value, even though the
 * schema always had a `stations[]` override array sitting unused. The
 * Default Routes settings page has just been changed to read/write that
 * per-station override when exactly one station is being viewed.
 *
 * Without this backfill, every station would start out with NO override,
 * silently falling back to the shared value — which is fine for whichever
 * station's number the shared field happens to hold, and WRONG for every
 * other station, exactly the "DXC8's 10:50 AM appearing in DFO2" bug this
 * was all triggered by. DFO2's future schedules were already repaired by
 * hand (check-cross-station-starttime-drift.mjs --fix); this script seeds
 * each station's stations[] override with what its own schedule history
 * actually shows as truth, so the settings page agrees with the schedules
 * from the moment the new code ships, and both stations can diverge safely
 * from there.
 *
 * Truth per station+type = the most recent schedule row's startTime for
 * that (siteId, typeId) pair. Only writes an override where that truth
 * differs from the shared value — a station that already matches the
 * shared default doesn't need one; it will keep resolving correctly via
 * fallback.
 *
 * Never overwrites an existing override (idempotent / safe to re-run).
 *
 * Usage:
 *   node scripts/migrate/17-backfill-routetype-station-overrides.mjs --dry-run
 *   node scripts/migrate/17-backfill-routetype-station-overrides.mjs --target=production --i-know-this-is-production
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "./lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "17-backfill-routetype-station-overrides" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();

  const sites = await db.collection("SYMXSites").find({ status: "active" }).project({ code: 1, name: 1 }).toArray();
  const routeTypes = await db.collection("SYMXRouteTypes").find({}).toArray();

  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Backfilling per-station startTime overrides for ${sites.length} station(s) × ${routeTypes.length} route type(s)\n`);

  let toWrite = 0;

  for (const rt of routeTypes) {
    const typeId = String(rt._id);
    const sharedStartTime = rt.startTime || "";
    const existingOverrideSiteIds = new Set((rt.stations || []).map((s) => String(s.siteId)));

    for (const site of sites) {
      if (existingOverrideSiteIds.has(String(site._id))) {
        continue; // never overwrite — idempotent
      }

      const recent = await db
        .collection("SYMXEmployeeSchedules")
        .find({ siteId: site._id, typeId })
        .sort({ date: -1 })
        .limit(1)
        .project({ startTime: 1, date: 1 })
        .toArray();

      if (recent.length === 0) continue; // no history at this station for this type
      const truth = recent[0].startTime || "";
      if (!truth || truth === sharedStartTime) continue; // fallback already gives the right answer

      toWrite++;
      console.log(
        `  ${site.code || site.name} — "${rt.name}": override "${truth}" ` +
        `(shared default is "${sharedStartTime}", as of ${recent[0].date.toISOString().slice(0, 10)})`
      );

      if (!DRY_RUN) {
        await db.collection("SYMXRouteTypes").updateOne(
          { _id: rt._id },
          { $push: { stations: { siteId: site._id, startTime: truth, theoryHrs: 0 } } }
        );
      }
    }
  }

  if (toWrite === 0) {
    console.log("Nothing to backfill — every station already agrees with the shared default, or already has an override.");
  } else {
    console.log(`\n${DRY_RUN ? "Would write" : "Wrote"} ${toWrite} station override(s).`);
    if (DRY_RUN) console.log("Re-run without --dry-run (with --target=production --i-know-this-is-production) to apply.");
  }

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
