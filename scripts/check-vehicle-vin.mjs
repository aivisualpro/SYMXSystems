#!/usr/bin/env node
/**
 * Read-only: finds a vehicle by VIN regardless of station or status.
 *
 * The "vehicles" collection's vin field is globally unique (one VIN =
 * one physical van, org-wide), but the admin UI's list is scoped to
 * whichever station is active and hides "Returned" vehicles by default —
 * so a duplicate-VIN error on Add Vehicle can point at a vehicle that's
 * genuinely invisible in your current view. This looks it up directly.
 *
 * Accepts a comma-separated list of VINs to check several at once (e.g.
 * a handful of import conflicts you want the full picture on before
 * deciding whether to transfer them).
 *
 * Usage:
 *   node scripts/check-vehicle-vin.mjs --vin=1FTBR3X88NKA12761
 *   node scripts/check-vehicle-vin.mjs --vin=VIN1,VIN2,VIN3 --target=production --i-know-this-is-production
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "./lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const vinArg = process.argv.find((a) => a.startsWith("--vin="));
const vins = vinArg
  ? vinArg.slice("--vin=".length).split(",").map((v) => v.trim()).filter(Boolean)
  : [];
if (vins.length === 0) {
  console.error("Usage: node scripts/check-vehicle-vin.mjs --vin=<VIN>[,<VIN2>,...] [--target=production --i-know-this-is-production]");
  process.exit(1);
}

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "check-vehicle-vin" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();

  const sites = await db.collection("SYMXSites").find({}).project({ code: 1, name: 1 }).toArray();
  const siteById = new Map(sites.map((s) => [String(s._id), `${s.code} — ${s.name}`]));

  for (const vin of vins) {
    // Case-insensitive, whitespace-tolerant — VINs get mistyped or pasted
    // with stray spaces often enough that an exact match alone would miss
    // the very thing someone's trying to find.
    const matches = await db
      .collection("vehicles")
      .find({ vin: { $regex: `^${vin}$`, $options: "i" } })
      .toArray();

    if (matches.length === 0) {
      console.log(`No vehicle found with VIN "${vin}" — check for a typo.\n`);
      continue;
    }

    for (const v of matches) {
      const station = v.currentSiteId ? (siteById.get(String(v.currentSiteId)) || "unknown station") : "UNASSIGNED (no station)";
      console.log(`VIN ${v.vin}`);
      console.log(`  Name / Unit:     ${v.vehicleName || "(no name)"}${v.unitNumber ? ` / Unit ${v.unitNumber}` : ""}`);
      console.log(`  Station:         ${station}`);
      console.log(`  Status:          ${v.status || "?"}`);
      console.log(`  Make / Model:    ${v.make || "?"} ${v.vehicleModel || ""} (${v.year || "?"})`);
      console.log(`  License Plate:   ${v.licensePlate || "—"}`);
      console.log(`  Ownership:       ${v.ownership || "—"}  Provider: ${v.vehicleProvider || "—"}`);
      console.log(`  Mileage:         ${v.mileage ?? "—"}`);
      console.log(`  State:           ${v.state || "—"}`);
      console.log(`  Start Date:      ${v.startDate ? new Date(v.startDate).toISOString().slice(0, 10) : "—"}`);
      console.log(`  Reg. Expiration: ${v.registrationExpiration ? new Date(v.registrationExpiration).toISOString().slice(0, 10) : "—"}`);
      console.log(`  Info:            ${v.info || "—"}`);
      console.log(`  _id:             ${v._id}`);
      console.log(`  Added:           ${v.createdAt ? v.createdAt.toISOString().slice(0, 10) : "?"}`);
      console.log("");
    }
  }

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
