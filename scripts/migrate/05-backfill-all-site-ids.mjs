#!/usr/bin/env node
/**
 * Multi-site Phase 2 — stamp EVERY existing record with its owning station.
 *
 * Everything currently in the system was produced at DFO2, so every
 * site-owned collection gets siteId = the default station, and employees
 * and vehicles get their assigned station.
 *
 * Ownership is permanent. If an employee later transfers to DXC8, their
 * DFO2-era routes, write-ups, schedules and inspections stay owned by
 * DFO2 — that is where the work happened. Only the employee's own
 * `primarySiteId` moves.
 *
 * Idempotent and resumable: only touches documents that lack the field,
 * so an interrupted run is re-runnable. Verifies zero unstamped documents
 * per collection before moving on, and fails loudly rather than reporting
 * a partial success.
 *
 * Usage:
 *   node scripts/migrate/05-backfill-all-site-ids.mjs --dry-run
 *   node scripts/migrate/05-backfill-all-site-ids.mjs
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

const env = loadEnv(rootDir);
const { uri: TARGET_URI } = resolveTargetDb(env, { scriptName: "05-backfill-all-site-ids" });

// ── Site-owned collections: get `siteId` ──────────────────────────────
// Must match the models carrying the siteOwned plugin in lib/models.
// A collection missing from this list keeps null siteIds and will simply
// stop appearing once scoping is enforced — so the post-check below
// reports any site-owned-looking collection that isn't covered.
const SITE_OWNED_COLLECTIONS = [
  // Operations
  "SYMXRoutes", "SYMXRoutesInfo", "SYMXRTS", "SYMXRescue", "SYMXEveryday",
  // Scheduling
  "SYMXEmployeeSchedules", "SYMXScheduleConfirmations", "ScheduleAuditLogs", "SymxAvailableWeeks",
  // Fleet
  "dailyInspections", "vehiclesInspections", "vehiclesRepairs",
  "vehiclesActivityLogs", "vehiclesRentalAgreements",
  // HR / discipline
  "SYMXWriteups", "SYMXVerbalCoachings", "SYMXCoachingWriteUps", "SYMXEmployeeNotes",
  "symxincidents", "symxhrtickets", "symxreimbursements", "symxinterviews",
  // Scorecards
  "ScoreCard_DCR", "ScoreCard_rts", "ScoreCard_CDF_Negative", "ScoreCard_QualityDSBDNR",
  "ScoreCard_DeliveryExcellence", "ScoreCard_PhotoOnDelivery",
  "ScoreCard_safetyDashboardDFO2", "ScoreCard_DVICVehicleInspection", "ScoreCardRemarks",
  // Comms
  "SYMXMessageLogs", "symxnotifications", "messagingtemplates",
  // Per-station settings
  "SYMXSettings", "symxcardconfigs", "SYMXWSTOptions", "SYMXRouteTypes",
  "SYMXWriteupSettings", "symxhrticketsettings", "symxreimbursementsettings",
  // Misc
  "symxpublicuploadlogs",
];

// ── Org-owned but station-assigned: transferable ──────────────────────
const SITE_ASSIGNED_COLLECTIONS = [
  { name: "SYMXEmployees", field: "primarySiteId" },
  { name: "vehicles", field: "currentSiteId" },
];

// Genuinely organization-level — no station, by design.
const ORG_LEVEL_COLLECTIONS = new Set([
  "SYMXOrganizations", "SYMXSites", "SYMXUserSiteAssignments", "SYMXOrgRoleGrants",
  "SYMXUsers", "symxapproles", "symxappmodules",
  "SYMXDropdownOptions",     // shared category catalogue — keeps reporting comparable
  "SYMXInsurancePolicies",   // corporate policies, cover every station
  "SYMXRTSSubmissions", "SymxDVICVehicleInspection", "SymxDeliveryExcellence", // empty legacy
]);

async function main() {
  const mongo = new MongoClient(TARGET_URI);
  await mongo.connect();
  const db = mongo.db();

  const defaultSite = await db.collection("SYMXSites").findOne({ isDefault: true });
  if (!defaultSite) {
    throw new Error("No default station found. Run 01-seed-org-and-sites.mjs first.");
  }
  console.log(`Owning station for all existing data: ${defaultSite.code} (${defaultSite._id})\n`);

  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  let totalStamped = 0;
  const missingFromDb = [];

  const stamp = async (name, field) => {
    if (!existing.has(name)) { missingFromDb.push(name); return; }
    const col = db.collection(name);
    const total = await col.countDocuments();
    const todo = await col.countDocuments({ [field]: { $exists: false } });

    if (total === 0) { console.log(`  ${name.padEnd(34)} empty`); return; }
    if (todo === 0)  { console.log(`  ${name.padEnd(34)} ${String(total).padStart(6)} — already stamped`); return; }
    if (DRY_RUN) {
      console.log(`  ${name.padEnd(34)} ${String(total).padStart(6)} — would stamp ${todo}`);
      totalStamped += todo;
      return;
    }

    const res = await col.updateMany({ [field]: { $exists: false } }, { $set: { [field]: defaultSite._id } });
    const remaining = await col.countDocuments({ [field]: { $exists: false } });
    if (remaining > 0) {
      throw new Error(`POST-CONDITION FAILED: ${name} still has ${remaining} document(s) without ${field}.`);
    }
    console.log(`  ${name.padEnd(34)} ${String(total).padStart(6)} — stamped ${res.modifiedCount} ✓`);
    totalStamped += res.modifiedCount;
  };

  console.log("Site-owned collections (siteId):");
  for (const name of SITE_OWNED_COLLECTIONS) await stamp(name, "siteId");

  console.log("\nStation-assigned collections (transferable):");
  for (const { name, field } of SITE_ASSIGNED_COLLECTIONS) await stamp(name, field);

  // ── Coverage check ──
  // A site-owned collection that nobody listed would silently keep null
  // siteIds and vanish from the UI the moment scoping is enforced. Report
  // anything unaccounted for rather than letting it be discovered later.
  const accounted = new Set([
    ...SITE_OWNED_COLLECTIONS,
    ...SITE_ASSIGNED_COLLECTIONS.map((c) => c.name),
    ...ORG_LEVEL_COLLECTIONS,
  ]);
  const unaccounted = [...existing].filter((n) => !accounted.has(n) && !n.startsWith("system."));

  if (missingFromDb.length > 0) {
    console.log(`\nListed but not present in this database (fine if unused): ${missingFromDb.join(", ")}`);
  }
  if (unaccounted.length > 0) {
    console.log(`\n⚠ ${unaccounted.length} collection(s) are in the database but classified nowhere:`);
    unaccounted.forEach((n) => console.log(`   • ${n}`));
    console.log(
      "   Decide for each: site-owned (add to SITE_OWNED_COLLECTIONS) or\n" +
      "   organization-level (add to ORG_LEVEL_COLLECTIONS). Leaving one\n" +
      "   unclassified means its records disappear once scoping is enforced."
    );
  }

  console.log(`\n${DRY_RUN ? "Would stamp" : "Stamped"} ${totalStamped} document(s).`);
  if (DRY_RUN) console.log("--dry-run set — no changes written.");

  await mongo.close();
  process.exitCode = unaccounted.length > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
