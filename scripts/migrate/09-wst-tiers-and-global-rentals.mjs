#!/usr/bin/env node
/**
 * Phase 3d — two WST rate tiers per station, and rentals go company-wide.
 *
 * 1. WST RATES become per-station AND per-tier.
 *
 *    Amazon's rate cards price each service line twice: once for routes
 *    scheduled 1–8 hours, once for routes scheduled over 8 hours. Which
 *    applies is decided by the route's duration, not by the WST.
 *
 *    Existing rates[] entries hold a single `revenue`. That value becomes
 *    BOTH tiers, so nothing changes numerically until the real over-8
 *    figures are entered — a station keeps pricing exactly as it did
 *    rather than suddenly halving or doubling a long route.
 *
 * 2. RENTAL AGREEMENTS become organization-level.
 *
 *    The contract is with the leasing company, not with a building, and
 *    one agreement can cover a van that moves between stations. Phase 2
 *    stamped them all to DFO2; this clears that.
 *
 * Idempotent.
 *
 * Usage:
 *   node scripts/migrate/09-wst-tiers-and-global-rentals.mjs --dry-run
 *   node scripts/migrate/09-wst-tiers-and-global-rentals.mjs
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "09-wst-tiers-and-global-rentals" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();

  const sites = await db.collection("SYMXSites").find({}).toArray();
  const codeOf = new Map(sites.map((s) => [String(s._id), s.code]));

  // ── 1. WST rate tiers ──
  console.log("WST rates → per-station, per-tier:\n");
  const options = await db.collection("SYMXWSTOptions").find({}).toArray();
  let converted = 0;
  let seeded = 0;

  for (const opt of options) {
    const rates = Array.isArray(opt.rates) ? opt.rates : [];
    let next = rates.map((r) => {
      // Already converted.
      if (typeof r.standard === "number" || typeof r.over8 === "number") return r;
      const v = typeof r.revenue === "number" ? r.revenue : 0;
      return { siteId: r.siteId, standard: v, over8: v };
    });

    // A station with no entry at all gets one seeded from the legacy flat
    // rate, so every station starts with a visible, editable number rather
    // than a blank that silently falls back.
    const have = new Set(next.map((r) => String(r.siteId)));
    for (const site of sites) {
      if (have.has(String(site._id))) continue;
      const v = typeof opt.revenue === "number" ? opt.revenue : 0;
      next.push({ siteId: site._id, standard: v, over8: v });
      seeded++;
    }

    const changed = JSON.stringify(next) !== JSON.stringify(rates);
    if (!changed) continue;

    const summary = next
      .map((r) => `${codeOf.get(String(r.siteId)) || "?"}=${r.standard}/${r.over8}`)
      .join(" ");
    console.log(`  ${String(opt.wst).padEnd(22)} ${summary}`);
    converted++;

    if (!DRY_RUN) {
      await db.collection("SYMXWSTOptions").updateOne(
        { _id: opt._id },
        { $set: { rates: next, updatedAt: new Date() } }
      );
    }
  }
  console.log(
    `\n  ${converted} option(s) ${DRY_RUN ? "would be " : ""}converted; ` +
      `${seeded} station rate(s) seeded from the legacy value.\n` +
      `  Both tiers start equal, so pricing does not change until the real\n` +
      `  over-8 figures are entered in Admin > Settings > WST.\n`
  );

  // ── 2. Rental agreements → organization-level ──
  console.log("Rental agreements → organization-level:");
  const rentals = db.collection("vehiclesRentalAgreements");
  const withSite = await rentals.countDocuments({ siteId: { $exists: true } });
  if (withSite === 0) {
    console.log("  already org-level");
  } else if (DRY_RUN) {
    console.log(`  would clear siteId on ${withSite}`);
  } else {
    const res = await rentals.updateMany(
      { siteId: { $exists: true } },
      { $unset: { siteId: "" } }
    );
    console.log(`  cleared siteId on ${res.modifiedCount} ✓`);
  }

  console.log(DRY_RUN ? "\n--dry-run set — nothing written." : "\n✓ Done.");
  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
