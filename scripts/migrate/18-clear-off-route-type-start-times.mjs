#!/usr/bin/env node
/**
 * Clears startTime/theoryHrs from every "OFF"-status RouteType — both the
 * shared field and any per-station stations[] override.
 *
 * Follow-up to migration 17: that backfill picked "the most recent
 * schedule row's startTime" as ground truth for every station+type, which
 * is a meaningless signal for a type nobody deliberately times — an OFF
 * day (Reduction, Call Out, Suspension, Stand by, Request Off...) has no
 * shift, so whatever value happened to be on the most recent row is noise,
 * not configuration. Confirmed by Rohan: these should never have a start
 * time at all. The app itself is now fixed to enforce this going forward
 * (app/api/admin/settings/route-types/route.ts forces startTime blank on
 * save for any OFF-status type); this is the one-time cleanup of what's
 * already sitting in the database, including whatever migration 17 just
 * wrote for Reduction/Call Out.
 *
 * Usage:
 *   node scripts/migrate/18-clear-off-route-type-start-times.mjs --dry-run
 *   node scripts/migrate/18-clear-off-route-type-start-times.mjs --target=production --i-know-this-is-production
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "18-clear-off-route-type-start-times" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();

  const offTypes = await db
    .collection("SYMXRouteTypes")
    .find({ routeStatus: { $regex: /^off$/i } })
    .toArray();

  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Found ${offTypes.length} OFF-status route type(s)\n`);

  let changed = 0;

  for (const rt of offTypes) {
    const sharedDirty = !!(rt.startTime && rt.startTime !== "0:00") || !!(rt.theoryHrs && rt.theoryHrs !== 0);
    const dirtyOverrides = (rt.stations || []).filter(
      (s) => (s.startTime && s.startTime !== "0:00") || (s.theoryHrs && s.theoryHrs !== 0)
    );

    if (!sharedDirty && dirtyOverrides.length === 0) continue;

    changed++;
    console.log(`  "${rt.name}"${sharedDirty ? ` — shared startTime "${rt.startTime}" → ""` : ""}`);
    for (const s of dirtyOverrides) {
      console.log(`      station ${s.siteId} — override "${s.startTime}" → cleared`);
    }

    if (!DRY_RUN) {
      await db.collection("SYMXRouteTypes").updateOne(
        { _id: rt._id },
        {
          $set: {
            startTime: "",
            theoryHrs: 0,
            stations: (rt.stations || []).map((s) => ({ siteId: s.siteId, startTime: "", theoryHrs: 0 })),
          },
        }
      );
    }
  }

  if (changed === 0) {
    console.log("Nothing to clear — no OFF-status type has a stray start time.");
  } else {
    console.log(`\n${DRY_RUN ? "Would clear" : "Cleared"} start time/theory hours on ${changed} OFF-status route type(s).`);
    if (DRY_RUN) console.log("Re-run without --dry-run (with --target=production --i-know-this-is-production) to apply.");
  }

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
