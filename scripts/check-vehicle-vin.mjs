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
 * Usage:
 *   node scripts/check-vehicle-vin.mjs --vin=1FTBR3X88NKA12761
 *   node scripts/check-vehicle-vin.mjs --vin=1FTBR3X88NKA12761 --target=production --i-know-this-is-production
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "./lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const vinArg = process.argv.find((a) => a.startsWith("--vin="));
const vin = vinArg ? vinArg.slice("--vin=".length).trim() : null;
if (!vin) {
  console.error("Usage: node scripts/check-vehicle-vin.mjs --vin=<VIN> [--target=production --i-know-this-is-production]");
  process.exit(1);
}

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "check-vehicle-vin" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();

  // Case-insensitive, whitespace-tolerant — VINs get mistyped or pasted
  // with stray spaces often enough that an exact match alone would miss
  // the very thing someone's trying to find.
  const matches = await db
    .collection("vehicles")
    .find({ vin: { $regex: `^${vin.trim()}$`, $options: "i" } })
    .toArray();

  if (matches.length === 0) {
    console.log(`No vehicle found with VIN "${vin}" — the duplicate-key error wasn't about an exact match on this string. Check for a typo, or search the vehicles collection more broadly.`);
    await mongo.close();
    return;
  }

  const sites = await db.collection("SYMXSites").find({}).project({ code: 1, name: 1 }).toArray();
  const siteById = new Map(sites.map((s) => [String(s._id), `${s.code} — ${s.name}`]));

  console.log(`Found ${matches.length} vehicle(s) with VIN "${vin}":\n`);
  for (const v of matches) {
    const station = v.currentSiteId ? (siteById.get(String(v.currentSiteId)) || "unknown station") : "UNASSIGNED (no station)";
    console.log(`  ${v.vehicleName || "(no name)"}${v.unitNumber ? ` — Unit ${v.unitNumber}` : ""}`);
    console.log(`    _id: ${v._id}`);
    console.log(`    Station: ${station}`);
    console.log(`    Status: ${v.status || "?"}`);
    console.log(`    Added: ${v.createdAt ? v.createdAt.toISOString().slice(0, 10) : "?"}`);
    console.log("");
  }

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
