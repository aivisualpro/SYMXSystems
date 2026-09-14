#!/usr/bin/env node
/**
 * Read-only diagnostic (with an optional --fix) for the "DFO2 driver got
 * DXC8's start time" report.
 *
 * Root cause (fixed in the app separately): the Default Routes settings
 * page edits RouteType.startTime, a single SHARED field with no
 * per-station override UI. A propagation feature that pushes a startTime
 * change onto future schedules was recently repaired (it used to match
 * zero documents, silently) but it propagated to every station ACTIVE in
 * the editor's site context — for an org admin that is usually every
 * station, so an edit meant for one station rewrote every station's
 * future schedules of that route type. That hole is now closed, but it
 * does nothing for schedules it already touched before the fix shipped.
 *
 * This script finds the damage by comparing, per station and route type,
 * the most recent PAST schedule's startTime (never touched by the
 * propagation, which only ever updates date >= today) against today's
 * FUTURE schedules of the same station+type. A mismatch means the future
 * rows were almost certainly overwritten by the bug, not intentionally
 * changed.
 *
 * Usage:
 *   node scripts/check-cross-station-starttime-drift.mjs
 *   node scripts/check-cross-station-starttime-drift.mjs --target=production --i-know-this-is-production
 *   node scripts/check-cross-station-starttime-drift.mjs --fix --target=production --i-know-this-is-production
 */
import { MongoClient, ObjectId } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "./lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const FIX = process.argv.includes("--fix");

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "check-cross-station-starttime-drift" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const sites = await db.collection("SYMXSites").find({ status: "active" }).project({ code: 1, name: 1 }).toArray();
  const routeTypes = await db.collection("SYMXRouteTypes").find({}).project({ name: 1 }).toArray();

  console.log(`Comparing past vs. future startTime, per station + route type, as of ${today.toISOString().slice(0, 10)}\n`);

  let totalDrift = 0;
  const fixes = [];

  for (const site of sites) {
    for (const rt of routeTypes) {
      const typeId = String(rt._id);

      // Most recent PAST row for this station+type — the ground truth,
      // since the propagation bug only ever touched date >= today.
      const pastRow = await db
        .collection("SYMXEmployeeSchedules")
        .find({ siteId: site._id, typeId, date: { $lt: today } })
        .sort({ date: -1 })
        .limit(1)
        .project({ startTime: 1, date: 1 })
        .toArray();

      if (pastRow.length === 0) continue; // no history to compare against
      const truth = pastRow[0].startTime || "";
      if (!truth) continue; // nothing meaningful to compare

      const mismatched = await db
        .collection("SYMXEmployeeSchedules")
        .find({
          siteId: site._id,
          typeId,
          date: { $gte: today },
          startTime: { $ne: truth },
        })
        .project({ date: 1, startTime: 1, transporterId: 1 })
        .toArray();

      if (mismatched.length === 0) continue;

      totalDrift++;
      console.log(`⚠ ${site.code || site.name} — "${rt.name}"`);
      console.log(`    Past (ground truth): "${truth}" (as of ${pastRow[0].date.toISOString().slice(0, 10)})`);
      const byValue = new Map();
      for (const m of mismatched) {
        const v = m.startTime || "(blank)";
        byValue.set(v, (byValue.get(v) || 0) + 1);
      }
      for (const [v, n] of byValue) {
        console.log(`    ${n} future row(s) now show "${v}" instead`);
      }
      console.log("");

      fixes.push({ siteId: site._id, siteLabel: site.code || site.name, typeId, typeName: rt.name, truth, count: mismatched.length });
    }
  }

  if (totalDrift === 0) {
    console.log("No drift found — no station's future schedules disagree with their own history for any route type.");
    await mongo.close();
    return;
  }

  if (!FIX) {
    console.log(`\n${totalDrift} station+type combination(s) affected. Re-run with --fix to restore future rows to their station's own historical value.`);
    await mongo.close();
    return;
  }

  console.log("── Applying fixes ──\n");
  for (const f of fixes) {
    const result = await db.collection("SYMXEmployeeSchedules").updateMany(
      { siteId: f.siteId, typeId: f.typeId, date: { $gte: today }, startTime: { $ne: f.truth } },
      { $set: { startTime: f.truth } }
    );
    console.log(`  ${f.siteLabel} — "${f.typeName}": restored ${result.modifiedCount} row(s) to "${f.truth}"`);
  }
  console.log("\n✓ Done.");

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
