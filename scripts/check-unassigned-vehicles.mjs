#!/usr/bin/env node
/**
 * Read-only: lists every Vehicle with no currentSiteId.
 *
 * The Fleet "Add Vehicle" form never asked which station a new van
 * belonged to, so every van added since multi-site launch was created
 * with NO currentSiteId at all. siteFilter's "unassigned" compatibility
 * shim only shows those vans to whoever is viewing the DEFAULT station —
 * so from DFO2 they silently appeared in the list (looking like it
 * "worked"), and from DXC8 (or any other station) they never showed up
 * at all ("adding vans on DXC8 is not working").
 *
 * The add-vehicle form is now fixed to require a station on every new
 * van, but this doesn't touch what's already in the database. This
 * script is just a worklist — there's no way to know from the data alone
 * which unassigned van belongs at which station, so each one needs a
 * quick human call. Once you know the answer, open that van's page in
 * Fleet > Vehicles and use the "Station" card (Transfer) to assign it —
 * that feature already exists and moves the van's repairs/inspections/
 * rentals with it.
 *
 * Usage:
 *   node scripts/check-unassigned-vehicles.mjs
 *   node scripts/check-unassigned-vehicles.mjs --target=production --i-know-this-is-production
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "./lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "check-unassigned-vehicles" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();

  const unassigned = await db
    .collection("vehicles")
    .find({ currentSiteId: { $exists: false } }, { projection: { vehicleName: 1, unitNumber: 1, vin: 1, status: 1, createdAt: 1 } })
    .sort({ createdAt: -1 })
    .toArray();

  // Also catch currentSiteId explicitly stored as null (belt and suspenders
  // — some drivers write null rather than omitting the field entirely).
  const unassignedNull = await db
    .collection("vehicles")
    .find({ currentSiteId: null }, { projection: { vehicleName: 1, unitNumber: 1, vin: 1, status: 1, createdAt: 1 } })
    .sort({ createdAt: -1 })
    .toArray();

  const all = [...unassigned, ...unassignedNull.filter((v) => !unassigned.some((u) => String(u._id) === String(v._id)))];

  if (all.length === 0) {
    console.log("No unassigned vehicles — every van already has a station.");
  } else {
    console.log(`${all.length} vehicle(s) with no station (visible today only from the default station's view):\n`);
    for (const v of all) {
      console.log(`  ${v.vehicleName || "(no name)"}${v.unitNumber ? ` — Unit ${v.unitNumber}` : ""}${v.vin ? ` — VIN ${v.vin}` : ""} — status: ${v.status || "?"} — added ${v.createdAt ? v.createdAt.toISOString().slice(0, 10) : "?"}`);
    }
    console.log("\nAssign each one from its vehicle page (Fleet > Vehicles > the van > Station card > Transfer).");
  }

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
