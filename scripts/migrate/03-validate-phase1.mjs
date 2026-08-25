#!/usr/bin/env node
/**
 * Multi-site Phase 1, step 3 — validate the migration.
 *
 * Read-only. Run it BEFORE the backfill to see the starting state, and
 * AFTER to confirm the end state. Exits non-zero if any check fails, so it
 * can gate a deploy.
 *
 * Checks:
 *   1. Exactly one Organization
 *   2. At least one Site, exactly one marked isDefault
 *   3. The default site is DFO2 (the site all existing data belongs to)
 *   4. Every active user has at least one open site assignment
 *   5. No assignment points at a non-existent user or site
 *   6. No user has duplicate open assignments to the same site
 *   7. Org-wide grants are reported (they should be deliberate, not accidental)
 *
 * Usage:
 *   node scripts/migrate/03-validate-phase1.mjs
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");

// Read-only, but still resolved through the same guard so the output
// always states which database was actually inspected.
const env = loadEnv(rootDir);
const { uri: TARGET_URI } = resolveTargetDb(env, { scriptName: "03-validate-phase1" });

const results = [];
const check = (name, passed, detail = "") => {
  results.push({ name, passed, detail });
  console.log(`${passed ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, TARGET_URI);
  const db = mongo.db();
  const orgCol = db.collection("SYMXOrganizations");
  const siteCol = db.collection("SYMXSites");
  const userCol = db.collection("SYMXUsers");
  const assignCol = db.collection("SYMXUserSiteAssignments");
  const grantCol = db.collection("SYMXOrgRoleGrants");

  console.log("Multi-site Phase 1 validation\n");

  // 1. Organization
  const orgCount = await orgCol.countDocuments();
  check("Exactly one organization", orgCount === 1, `found ${orgCount}`);
  const org = await orgCol.findOne();

  // 2. Sites
  const sites = await siteCol.find({}).toArray();
  check("At least one site exists", sites.length >= 1, `found ${sites.length}`);
  const defaults = sites.filter((s) => s.isDefault);
  check("Exactly one default site", defaults.length === 1, `found ${defaults.length}`);

  // 3. Default is DFO2
  if (defaults.length === 1) {
    check(
      "Default site is DFO2",
      defaults[0].code === "DFO2",
      `default is "${defaults[0].code}"`
    );
  }

  console.log("\n  Sites:");
  for (const s of sites) {
    console.log(
      `    ${String(s.code).padEnd(6)} ${String(s.siteType).padEnd(10)} ${String(s.status).padEnd(9)}` +
        `${s.isDefault ? " [DEFAULT]" : ""}`
    );
  }
  console.log("");

  // 4. Every active user assigned
  const activeUsers = await userCol.countDocuments({ isActive: { $ne: false } });
  const assignedUserIds = await assignCol.distinct("userId", { endDate: null });
  const unassigned = await userCol
    .find({ isActive: { $ne: false }, _id: { $nin: assignedUserIds } }, { projection: { email: 1 } })
    .limit(20)
    .toArray();
  check(
    "Every active user has a site assignment",
    unassigned.length === 0,
    `${activeUsers} active users, ${unassigned.length} unassigned`
  );
  if (unassigned.length > 0) {
    unassigned.forEach((u) => console.log(`      - ${u.email}`));
  }

  // 5. No orphaned assignments
  const allAssignments = await assignCol.find({}).toArray();
  const siteIds = new Set(sites.map((s) => String(s._id)));
  const userIds = new Set((await userCol.find({}, { projection: { _id: 1 } }).toArray()).map((u) => String(u._id)));
  const orphanSite = allAssignments.filter((a) => !siteIds.has(String(a.siteId)));
  const orphanUser = allAssignments.filter((a) => !userIds.has(String(a.userId)));
  check("No assignment points at a missing site", orphanSite.length === 0, `${orphanSite.length} orphaned`);
  check("No assignment points at a missing user", orphanUser.length === 0, `${orphanUser.length} orphaned`);

  // 6. No duplicate open assignments
  const dupes = await assignCol
    .aggregate([
      { $match: { endDate: null } },
      { $group: { _id: { userId: "$userId", siteId: "$siteId" }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();
  check("No duplicate open assignments", dupes.length === 0, `${dupes.length} duplicated pairs`);

  // 7. Org-wide grants — reported, not failed. These SHOULD exist eventually
  //    (executives), but they must be deliberate. A backfill should never
  //    have created any.
  const grants = await grantCol.find({ endDate: null }).toArray();
  console.log(`\n  Org-wide grants: ${grants.length}`);
  for (const g of grants) {
    const u = await userCol.findOne({ _id: g.userId }, { projection: { email: 1 } });
    console.log(`    ${u?.email || g.userId} — ${g.scope} (granted by ${g.grantedBy || "?"})`);
  }
  if (grants.length === 0) {
    console.log("    (none — expected right after migration; grant executives explicitly in Owner > Sites)");
  }

  // ── Summary ──
  const failed = results.filter((r) => !r.passed);
  console.log(`\n${"─".repeat(50)}`);
  if (failed.length === 0) {
    console.log(`PASS — ${results.length} checks OK.`);
  } else {
    console.log(`FAIL — ${failed.length} of ${results.length} checks failed:`);
    failed.forEach((f) => console.log(`  ✗ ${f.name}`));
  }

  await mongo.close();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
