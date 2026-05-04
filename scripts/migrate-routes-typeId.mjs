/**
 * Migration: Stamp typeId onto SYMXRoutes
 * ─────────────────────────────────────────
 * For every document in SYMXRoutes, find the matching SYMXRouteTypes record
 * by name (case-insensitive) and write its _id as a string to the typeId field.
 *
 * Run with:
 *   node scripts/migrate-routes-typeId.mjs
 *
 * Requires MONGODB_URI in your .env.local (or set it inline below).
 */

import { MongoClient } from "mongodb";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load .env.local ──
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
    console.warn("⚠️  Could not load .env.local — using existing env vars");
  }
}

loadEnv();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI not set. Check your .env.local");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log("✅  Connected to MongoDB");

  const db = client.db(); // uses the DB in the connection string

  const routeTypesCol = db.collection("SYMXRouteTypes");
  const routesCol = db.collection("SYMXRoutes");

  // 1. Build name → _id map (case-insensitive)
  const routeTypes = await routeTypesCol.find({}).toArray();
  const typeNameMap = new Map();
  for (const rt of routeTypes) {
    typeNameMap.set((rt.name || "").trim().toLowerCase(), String(rt._id));
  }
  console.log(`📋  Loaded ${routeTypes.length} route types`);

  // 2. Fetch all routes (only _id + type fields needed)
  const routes = await routesCol.find({}, { projection: { _id: 1, type: 1 } }).toArray();
  console.log(`🚛  Found ${routes.length} routes to process`);

  // 3. Build bulk operations
  const ops = [];
  let matched = 0;
  let unmatched = 0;
  const unmatchedTypes = new Set();

  for (const route of routes) {
    const typeKey = (route.type || "").trim().toLowerCase();
    const typeId = typeNameMap.get(typeKey);

    if (typeId) {
      ops.push({
        updateOne: {
          filter: { _id: route._id },
          update: { $set: { typeId } },
        },
      });
      matched++;
    } else {
      unmatched++;
      if (typeKey) unmatchedTypes.add(route.type || "(empty)");
    }
  }

  console.log(`\n📊  Match summary:`);
  console.log(`   ✅ Matched:   ${matched}`);
  console.log(`   ⚠️  Unmatched: ${unmatched}`);
  if (unmatchedTypes.size > 0) {
    console.log(`   ⚠️  Unmatched type strings: ${[...unmatchedTypes].join(", ")}`);
  }

  // 4. Execute bulk write
  if (ops.length > 0) {
    const result = await routesCol.bulkWrite(ops, { ordered: false });
    console.log(`\n✅  Bulk write complete: ${result.modifiedCount} documents updated`);
  } else {
    console.log("\nℹ️  No operations to run.");
  }

  await client.close();
  console.log("🔒  Connection closed. Done!");
}

main().catch((err) => {
  console.error("❌  Migration failed:", err);
  process.exit(1);
});
