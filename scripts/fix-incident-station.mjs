#!/usr/bin/env node
/**
 * One-off (but reusable) fix for an incident that saved under the wrong
 * station — e.g. one that predates the siteId-stamping fix in
 * app/api/incidents/route.ts and got defaulted to DFO2 by the earlier
 * universal "stamp every record to DFO2" migration, even though it was
 * actually reported at a different station.
 *
 * Finds by employee name + incident date (both shown on the incident
 * detail view), prints the match for confirmation, and reassigns its
 * siteId to the station code you specify.
 *
 * Usage:
 *   node scripts/fix-incident-station.mjs --employee="Jessica Ann Martinez" --date=2026-09-25 --station=DXC8 --dry-run
 *   node scripts/fix-incident-station.mjs --employee="Jessica Ann Martinez" --date=2026-09-25 --station=DXC8 --target=production --i-know-this-is-production
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "./lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");

const getArg = (name) => {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : "";
};

const employeeName = getArg("employee").trim();
const dateStr = getArg("date").trim();
const stationCode = getArg("station").trim().toUpperCase();

if (!employeeName || !dateStr || !stationCode) {
  console.error(
    'Usage: node scripts/fix-incident-station.mjs --employee="First Last" --date=YYYY-MM-DD --station=CODE [--dry-run] [--target=production --i-know-this-is-production]'
  );
  process.exit(1);
}

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "fix-incident-station" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();

  const site = await db.collection("SYMXSites").findOne({ code: stationCode });
  if (!site) {
    console.error(`No site found with code "${stationCode}". Aborting.`);
    await mongo.close();
    process.exit(1);
  }

  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
  const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

  const matches = await db
    .collection("SymxIncidents")
    .find({
      employeeName: { $regex: `^${employeeName}$`, $options: "i" },
      incidentDate: { $gte: dayStart, $lte: dayEnd },
    })
    .toArray();

  if (matches.length === 0) {
    console.log(`No incident found for "${employeeName}" on ${dateStr}.`);
    await mongo.close();
    return;
  }

  const sites = await db.collection("SYMXSites").find({}).project({ code: 1, name: 1 }).toArray();
  const siteLabel = (id) => {
    if (!id) return "unassigned (no station)";
    const s = sites.find((x) => String(x._id) === String(id));
    return s ? `${s.code} — ${s.name}` : "unknown station";
  };

  for (const inc of matches) {
    console.log(`Incident ${inc._id}`);
    console.log(`  Employee:      ${inc.employeeName}`);
    console.log(`  Type:          ${inc.claimType}`);
    console.log(`  Incident Date: ${inc.incidentDate?.toISOString().slice(0, 10)}`);
    console.log(`  Currently at:  ${siteLabel(inc.siteId)}`);
    console.log(`  ${DRY_RUN ? "Would move" : "Moving"} to: ${site.code} — ${site.name}`);
    console.log("");

    if (!DRY_RUN) {
      await db.collection("SymxIncidents").updateOne(
        { _id: inc._id },
        { $set: { siteId: site._id } }
      );
    }
  }

  console.log(`${matches.length} incident(s) ${DRY_RUN ? "would be" : "were"} reassigned to ${stationCode}.`);
  if (DRY_RUN) console.log("Re-run without --dry-run (with --target=production --i-know-this-is-production) to apply.");

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
