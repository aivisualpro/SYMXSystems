/**
 * Migration: Stamp vin onto SYMXRoutes
 * ─────────────────────────────────────────
 * For every document in SYMXRoutes that has a non-empty "van" field,
 * look up the matching vehicle in the "vehicles" collection by vehicleName,
 * and write its "vin" to the SYMXRoutes document.
 *
 * Run with:
 *   node scripts/migrate-routes-vin.mjs
 *
 * Requires MONGODB_URI in your .env (or set it inline).
 */

import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load .env ──
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const lines = readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = value;
      }
    }
  } catch {
    console.warn("⚠️  Could not load .env — using existing env vars");
  }
}

loadEnv();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI not set. Check your .env");
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log("✅  Connected to MongoDB");

  const db = mongoose.connection.db;

  const vehiclesCol = db.collection("vehicles");
  const routesCol = db.collection("SYMXRoutes");

  // 1. Build vehicleName → vin map from vehicles collection
  const vehicles = await vehiclesCol.find(
    { vehicleName: { $nin: ["", null] }, vin: { $nin: ["", null] } },
    { projection: { vehicleName: 1, vin: 1 } }
  ).toArray();

  const vehicleNameToVin = new Map();
  for (const v of vehicles) {
    vehicleNameToVin.set((v.vehicleName || "").trim(), v.vin);
  }
  console.log(`🚗  Loaded ${vehicles.length} vehicles with vehicleName → vin mapping`);

  // 2. Fetch routes with a non-empty "van" from W19 onwards only
  const routes = await routesCol.find(
    { van: { $nin: ["", null] }, yearWeek: { $gte: "2026-W19" } },
    { projection: { _id: 1, van: 1, vin: 1, yearWeek: 1 } }
  ).toArray();
  console.log(`🚛  Found ${routes.length} routes with a "van" value (W19+)`);

  // 3. Build bulk operations
  const ops = [];
  let matched = 0;
  let alreadySet = 0;
  let unmatched = 0;
  const unmatchedVans = new Set();

  for (const route of routes) {
    const vanName = (route.van || "").trim();
    const vin = vehicleNameToVin.get(vanName);

    if (vin) {
      // Skip if vin is already set correctly
      if (route.vin === vin) {
        alreadySet++;
        continue;
      }
      ops.push({
        updateOne: {
          filter: { _id: route._id },
          update: { $set: { vin } },
        },
      });
      matched++;
    } else {
      unmatched++;
      if (vanName) unmatchedVans.add(vanName);
    }
  }

  console.log(`\n📊  Match summary:`);
  console.log(`   ✅ Matched:      ${matched}`);
  console.log(`   ⏩ Already set:  ${alreadySet}`);
  console.log(`   ⚠️  Unmatched:    ${unmatched}`);
  if (unmatchedVans.size > 0) {
    console.log(`   ⚠️  Unmatched van names: ${[...unmatchedVans].join(", ")}`);
  }

  // 4. Execute bulk write
  if (ops.length > 0) {
    const result = await routesCol.bulkWrite(ops, { ordered: false });
    console.log(`\n✅  Bulk write complete: ${result.modifiedCount} documents updated`);
  } else {
    console.log("\nℹ️  No operations to run (all already up-to-date or no matches).");
  }

  await mongoose.disconnect();
  console.log("🔒  Connection closed. Done!");
}

main().catch((err) => {
  console.error("❌  Migration failed:", err);
  process.exit(1);
});
