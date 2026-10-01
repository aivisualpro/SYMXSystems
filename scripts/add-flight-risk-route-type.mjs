#!/usr/bin/env node
/**
 * One-off (but reusable/idempotent) setup script: adds a new "Flight Risk"
 * shift type to the shared RouteType catalogue.
 *
 * RouteTypes are a SINGLE org-wide catalogue (see lib/models/RouteType.ts) —
 * there's no siteId on the collection at all, only per-station START TIME
 * overrides in each document's own `stations[]` array. So creating one new
 * document here makes "Flight Risk" available at every station immediately;
 * there is no per-station loop to run.
 *
 * "Flight Risk" is meant to behave exactly like "Route" everywhere that
 * reads a schedule/route's typeId (routeStatus, DA/Ops counting, schedule
 * confirmation flow, needing a van, per-station start times, showing up on
 * the routes/dispatching board) — it just means "we expect this person not
 * to show up tomorrow," so dispatchers can see it called out instead of it
 * blending into the normal Route list. To get that, this script clones
 * Route's routeStatus / isDA / isOps / isStandby / group / partOf /
 * startTime / per-station stations[] overrides onto the new type, and only
 * changes the name, color, and icon so it's visually distinct.
 *
 * Usage:
 *   node scripts/add-flight-risk-route-type.mjs --dry-run
 *   node scripts/add-flight-risk-route-type.mjs --target=production --i-know-this-is-production
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "./lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");

const NEW_NAME = "Flight Risk";
const NEW_COLOR = "#DC2626"; // red — meant to stand out from Route's usual color
const NEW_ICON = "Flag";

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "add-flight-risk-route-type" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();
  const col = db.collection("SYMXRouteTypes");

  const existing = await col.findOne({ name: { $regex: `^${NEW_NAME}$`, $options: "i" } });
  if (existing) {
    console.log(`"${NEW_NAME}" already exists (_id ${existing._id}) — nothing to do.`);
    await mongo.close();
    return;
  }

  const route = await col.findOne({ name: { $regex: "^route$", $options: "i" } });
  if (!route) {
    console.error('No "Route" shift type found to clone characteristics from. Aborting — create Route first.');
    await mongo.close();
    process.exit(1);
  }

  const maxSortOrder = await col.find({}).sort({ sortOrder: -1 }).limit(1).toArray();
  const sortOrder = (maxSortOrder[0]?.sortOrder || 0) + 1;

  const doc = {
    name: NEW_NAME,
    color: NEW_COLOR,
    startTime: route.startTime || "",
    theoryHrs: route.theoryHrs || 0,
    // Clone each station's own override so Flight Risk starts at the same
    // time Route does at every station, exactly like Route itself.
    stations: Array.isArray(route.stations) ? route.stations.map((s) => ({ ...s })) : [],
    group: route.group || "None",
    routeStatus: route.routeStatus || "Scheduled",
    isDefault: false, // Route stays the default pick for new schedules; this is opt-in
    partOf: Array.isArray(route.partOf) ? [...route.partOf] : [],
    isDA: !!route.isDA,
    isOps: !!route.isOps,
    isStandby: !!route.isStandby,
    icon: NEW_ICON,
    sortOrder,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  console.log(`${DRY_RUN ? "[DRY RUN] Would create" : "Creating"} "${NEW_NAME}" cloned from "${route.name}":`);
  console.log(JSON.stringify({ ...doc, stations: `${doc.stations.length} station override(s)` }, null, 2));

  if (!DRY_RUN) {
    const result = await col.insertOne(doc);
    console.log(`\nCreated "${NEW_NAME}" (_id ${result.insertedId}). Available at every station immediately.`);
  } else {
    console.log("\nRe-run without --dry-run (with --target=production --i-know-this-is-production) to apply.");
  }

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
