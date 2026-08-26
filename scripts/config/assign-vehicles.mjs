#!/usr/bin/env node
/**
 * Assign vans to a station, in bulk, by unit number or VIN.
 *
 * Standing up DXC8 or DFO3 means moving a batch of vans at once. Doing
 * that through the UI one van at a time invites stopping halfway with no
 * record of which ones moved.
 *
 * A van's history moves with it. Repairs, inspections, rental agreements
 * and activity log are repointed at the destination, because the station
 * running a van needs its complete record and carries its cost.
 *
 * Usage:
 *   node scripts/config/assign-vehicles.mjs --list
 *   node scripts/config/assign-vehicles.mjs --station=DXC8 --units=101,102,103 --dry-run
 *   node scripts/config/assign-vehicles.mjs --station=DXC8 --units=101,102,103
 *   node scripts/config/assign-vehicles.mjs --station=DFO3 --vins=1FT...,1FT...
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIST = args.includes("--list");
const arg = (k) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
};

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "assign-vehicles" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();

  const sites = await db.collection("SYMXSites").find({}).toArray();
  const codeOf = new Map(sites.map((s) => [String(s._id), s.code]));

  // ── Report current distribution ──
  if (LIST) {
    const rows = await db
      .collection("vehicles")
      .aggregate([{ $group: { _id: "$currentSiteId", n: { $sum: 1 } } }])
      .toArray();
    console.log("\nVans per station:");
    for (const r of rows) {
      console.log(`  ${(r._id ? codeOf.get(String(r._id)) || "?" : "(unassigned)").padEnd(14)} ${r.n}`);
    }
    console.log("\nList unit numbers at a station with:");
    console.log("  node scripts/config/assign-vehicles.mjs --list --station=DFO2\n");

    const code = arg("station");
    if (code) {
      const site = sites.find((s) => s.code === code.toUpperCase());
      if (!site) throw new Error(`No station "${code}". Available: ${sites.map((s) => s.code).join(", ")}`);
      const vans = await db
        .collection("vehicles")
        .find({ currentSiteId: site._id }, { projection: { unitNumber: 1, vehicleName: 1, status: 1 } })
        .sort({ unitNumber: 1 })
        .toArray();
      console.log(`${vans.length} van(s) at ${site.code}:`);
      for (const v of vans) {
        console.log(`  ${String(v.unitNumber || "—").padEnd(10)} ${(v.vehicleName || "").padEnd(28)} ${v.status || ""}`);
      }
      console.log("");
    }
    await mongo.close();
    return;
  }

  const code = (arg("station") || "").toUpperCase();
  if (!code) throw new Error("--station=CODE is required (e.g. --station=DXC8). Use --list to see options.");

  const site = sites.find((s) => s.code === code);
  if (!site) throw new Error(`No station "${code}". Available: ${sites.map((s) => s.code).join(", ")}`);
  if (site.status !== "active") throw new Error(`${code} is closed (status: ${site.status}).`);

  const units = (arg("units") || "").split(",").map((u) => u.trim()).filter(Boolean);
  const vins = (arg("vins") || "").split(",").map((v) => v.trim()).filter(Boolean);
  if (units.length === 0 && vins.length === 0) {
    throw new Error("Provide --units=101,102 or --vins=1FT...,1FT...");
  }

  const match = { $or: [] };
  if (units.length) match.$or.push({ unitNumber: { $in: units } });
  if (vins.length) match.$or.push({ vin: { $in: vins } });

  const found = await db.collection("vehicles").find(match).toArray();

  // Report what was asked for but not found, rather than moving a subset
  // and reporting success — a typo in a unit number would otherwise pass
  // unnoticed and leave that van behind.
  const foundUnits = new Set(found.map((v) => String(v.unitNumber)));
  const foundVins = new Set(found.map((v) => v.vin));
  const missing = [
    ...units.filter((u) => !foundUnits.has(u)).map((u) => `unit ${u}`),
    ...vins.filter((v) => !foundVins.has(v)).map((v) => `vin ${v}`),
  ];

  const already = found.filter((v) => String(v.currentSiteId || "") === String(site._id));
  const toMove = found.filter((v) => String(v.currentSiteId || "") !== String(site._id));

  console.log(`\nDestination: ${site.code} (${site.name})`);
  console.log(`Matched ${found.length} van(s); ${toMove.length} to move, ${already.length} already there.\n`);

  for (const v of toMove) {
    const from = v.currentSiteId ? codeOf.get(String(v.currentSiteId)) || "?" : "(unassigned)";
    console.log(`  ${String(v.unitNumber || v.vin).padEnd(12)} ${from} → ${site.code}`);
  }

  if (missing.length) {
    console.log(`\n⚠ ${missing.length} not found: ${missing.join(", ")}`);
  }

  if (DRY_RUN) {
    console.log("\n--dry-run set — nothing was written.");
    await mongo.close();
    process.exitCode = missing.length ? 1 : 0;
    return;
  }

  if (toMove.length > 0) {
    await db.collection("vehicles").updateMany(
      { _id: { $in: toMove.map((v) => v._id) } },
      { $set: { currentSiteId: site._id } }
    );

    // Audit entry per van, matching what the UI transfer writes.
    await db.collection("vehiclesActivityLogs").insertMany(
      toMove.map((v) => ({
        vehicleId: v._id,
        vin: v.vin || "",
        serviceType: "Station transfer",
        startDate: new Date(),
        notes:
          `Transferred from ${v.currentSiteId ? codeOf.get(String(v.currentSiteId)) || "?" : "unassigned"} ` +
          `to ${site.code} via assign-vehicles script`,
        siteId: site._id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    );
    // History follows each van, matched by VIN — the vehicle's identity,
    // one VIN to one van for its whole life. vehicleId too, since some
    // collections link by document id.
    //
    // NOT unitNumber: those are fleet labels that get reassigned to a
    // different van when one is retired, so matching on one would drag
    // some other vehicle's repair history along with this transfer.
    let historyMoved = 0;
    for (const v of toMove) {
      const or = [{ vehicleId: v._id }];
      if (v.vin) or.push({ vin: v.vin });
      for (const col of [
        "vehiclesRepairs", "vehiclesInspections", "vehiclesRentalAgreements",
        "vehiclesActivityLogs", "dailyInspections",
      ]) {
        const r = await db.collection(col).updateMany({ $or: or }, { $set: { siteId: site._id } });
        historyMoved += r.modifiedCount;
      }
    }

    console.log(`\n✓ Moved ${toMove.length} van(s) to ${site.code}.`);
    console.log(`  ${historyMoved} history record(s) moved with them.`);
  }

  await mongo.close();
  process.exitCode = missing.length ? 1 : 0;
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
