#!/usr/bin/env node
/**
 * Phase 3 — apply the config decisions, and give the new stations
 * something to work with.
 *
 * Two parts:
 *
 * 1. RECLASSIFY messaging templates as organization-level. Wording is the
 *    same everywhere; the station-specific parts (start times, route
 *    names, rates) come from the data merged INTO a template, not from
 *    the template. Phase 2 stamped them all to DFO2, so this clears that.
 *
 * 2. CLONE per-station config to DXC8 and DFO3. Route types, WST options
 *    and settings stay site-owned because start times and rates differ by
 *    station — which means the new stations currently have none at all,
 *    and route generation there would produce nothing. Cloning DFO2's as
 *    a starting point is far better than an empty screen; the values are
 *    then edited per station.
 *
 * Cloned config is a STARTING POINT, not the truth. Rates and start times
 * must be reviewed per station — the clone exists so there is something
 * to edit rather than something to create from scratch.
 *
 * Idempotent: re-running skips anything already present.
 *
 * Usage:
 *   node scripts/migrate/06-reclassify-and-seed-station-config.mjs --dry-run
 *   node scripts/migrate/06-reclassify-and-seed-station-config.mjs
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

const env = loadEnv(rootDir);
const { uri: TARGET_URI } = resolveTargetDb(env, { scriptName: "06-reclassify-and-seed-station-config" });

// Collections that become organization-level: drop the siteId Phase 2 added.
const RECLASSIFY_TO_ORG = ["messagingtemplates"];

// Per-station config to clone from the default station to the others.
const CLONE_PER_STATION = [
  { name: "SYMXRouteTypes", label: "route types" },
  { name: "SYMXWSTOptions", label: "WST options" },
  { name: "SYMXSettings", label: "settings" },
  { name: "symxcardconfigs", label: "card configs" },
];

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, TARGET_URI);
  const db = mongo.db();

  const sites = await db.collection("SYMXSites").find({}).toArray();
  const defaultSite = sites.find((s) => s.isDefault);
  if (!defaultSite) throw new Error("No default station found. Run 01-seed-org-and-sites.mjs first.");
  const others = sites.filter((s) => !s.isDefault);

  console.log(`Default station: ${defaultSite.code}`);
  console.log(`Other stations:  ${others.map((s) => s.code).join(", ") || "(none)"}\n`);

  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));

  // ── 1. Reclassify to organization-level ──
  console.log("Reclassifying as organization-level (removing siteId):");
  for (const name of RECLASSIFY_TO_ORG) {
    if (!existing.has(name)) {
      console.log(`  ${name.padEnd(28)} not present`);
      continue;
    }
    const col = db.collection(name);
    const withSite = await col.countDocuments({ siteId: { $exists: true } });
    if (withSite === 0) {
      console.log(`  ${name.padEnd(28)} already org-level`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  ${name.padEnd(28)} would clear siteId on ${withSite}`);
      continue;
    }
    const res = await col.updateMany({ siteId: { $exists: true } }, { $unset: { siteId: "" } });
    console.log(`  ${name.padEnd(28)} cleared siteId on ${res.modifiedCount} ✓`);
  }

  // ── 2. Clone per-station config ──
  console.log("\nCloning per-station config from " + defaultSite.code + ":");
  if (others.length === 0) console.log("  (no other stations yet)");

  for (const site of others) {
    console.log(`\n  → ${site.code}`);
    for (const { name, label } of CLONE_PER_STATION) {
      if (!existing.has(name)) {
        console.log(`      ${label.padEnd(16)} collection not present`);
        continue;
      }
      const col = db.collection(name);

      // Idempotency: never clone twice into the same station.
      const already = await col.countDocuments({ siteId: site._id });
      if (already > 0) {
        console.log(`      ${label.padEnd(16)} ${already} already present — skipped`);
        continue;
      }

      const source = await col.find({ siteId: defaultSite._id }).toArray();
      if (source.length === 0) {
        console.log(`      ${label.padEnd(16)} nothing at ${defaultSite.code} to clone`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`      ${label.padEnd(16)} would clone ${source.length}`);
        continue;
      }

      // New _id per copy: these are independent records that will diverge
      // as each station edits its own rates and start times. Reusing ids
      // would collide, and sharing one document would mean editing one
      // station's rate silently changed the others'.
      const copies = source.map(({ _id, ...rest }) => ({
        ...rest,
        siteId: site._id,
        clonedFrom: _id,
        clonedAt: new Date(),
      }));
      await col.insertMany(copies, { ordered: false });
      console.log(`      ${label.padEnd(16)} cloned ${copies.length} ✓`);
    }
  }

  console.log(
    DRY_RUN
      ? "\n--dry-run set — nothing was written."
      : "\n✓ Done.\n\n" +
        "  Cloned config is a STARTING POINT copied from " + defaultSite.code + ".\n" +
        "  Start times and WST rates differ per station and must be reviewed\n" +
        "  for each one before that station is used for real scheduling."
  );

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
