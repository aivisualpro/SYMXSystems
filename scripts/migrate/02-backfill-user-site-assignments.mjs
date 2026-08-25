#!/usr/bin/env node
/**
 * Multi-site Phase 1, step 2 — assign every existing user to DFO2.
 *
 * All current users belong to DFO2, so each active SymxUser gets one
 * UserSiteAssignment to the default site, carrying the role they already
 * hold (SymxUser.AppRole). Nobody's effective permissions change: they had
 * that role before, they have that role at DFO2 now.
 *
 * Deliberately NOT done here:
 *   • No org-wide grants. Company-wide access to all three stations is a
 *     policy decision, not a migration side effect — grant it explicitly in
 *     Owner > Sites afterwards. Auto-granting it to admins during a backfill
 *     is exactly the kind of accidental company-wide access the design is
 *     meant to prevent.
 *   • The super admin is skipped — that account is env-var based
 *     (id "super-admin"), has no SymxUser row, and already bypasses scoping.
 *
 * Idempotent and resumable: skips users who already have an open assignment
 * to the site, so an interrupted run can simply be re-run.
 *
 * Usage:
 *   node scripts/migrate/02-backfill-user-site-assignments.mjs --dry-run
 *   node scripts/migrate/02-backfill-user-site-assignments.mjs
 *   node scripts/migrate/02-backfill-user-site-assignments.mjs --include-inactive
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");
// Deactivated users are skipped by default — they cannot log in, so granting
// them site access adds noise to the access audit for no benefit. Pass this
// flag if you want their assignments recorded anyway (e.g. for reporting on
// historical access).
const INCLUDE_INACTIVE = process.argv.includes("--include-inactive");
const BATCH_SIZE = 200;

// Defaults to STAGING when STAGING_MONGODB_URI exists. Hitting production
// requires --target=production --i-know-this-is-production.
const env = loadEnv(rootDir);
const { uri: TARGET_URI } = resolveTargetDb(env, { scriptName: "02-backfill-user-site-assignments" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, TARGET_URI);
  const db = mongo.db();
  const siteCol = db.collection("SYMXSites");
  const userCol = db.collection("SYMXUsers");
  const roleCol = db.collection("symxapproles");
  const assignCol = db.collection("SYMXUserSiteAssignments");

  // ── Pre-conditions ──
  const defaultSite = await siteCol.findOne({ isDefault: true });
  if (!defaultSite) {
    throw new Error(
      "No default site found. Run 01-seed-org-and-sites.mjs first — this script " +
        "backfills every user to the isDefault site (DFO2)."
    );
  }
  console.log(`Backfill target: ${defaultSite.code} (${defaultSite._id})\n`);

  // Map role names -> ids so assignments carry both (name mirrors how
  // SymxUser.AppRole works today; id is the forward-looking reference).
  const roles = await roleCol.find({}, { projection: { name: 1 } }).toArray();
  const roleIdByName = new Map(roles.map((r) => [r.name, r._id]));

  const userFilter = INCLUDE_INACTIVE ? {} : { isActive: { $ne: false } };
  const totalUsers = await userCol.countDocuments(userFilter);
  console.log(`Users to process: ${totalUsers}${INCLUDE_INACTIVE ? " (including inactive)" : " (active only)"}\n`);

  let processed = 0;
  let created = 0;
  let skipped = 0;
  const missingRole = [];

  const cursor = userCol.find(userFilter, { projection: { email: 1, name: 1, AppRole: 1, isActive: 1 } });
  let batch = [];

  const flush = async () => {
    if (batch.length === 0) return;
    if (!DRY_RUN) await assignCol.insertMany(batch, { ordered: false });
    created += batch.length;
    batch = [];
  };

  while (await cursor.hasNext()) {
    const user = await cursor.next();
    processed++;

    // Already assigned (open assignment) — resumability.
    const existing = await assignCol.findOne({
      userId: user._id,
      siteId: defaultSite._id,
      endDate: null,
    });
    if (existing) {
      skipped++;
      continue;
    }

    const roleName = user.AppRole || "";
    const roleId = roleIdByName.get(roleName) || null;
    if (roleName && !roleId) missingRole.push(`${user.email} (role "${roleName}")`);

    batch.push({
      userId: user._id,
      siteId: defaultSite._id,
      roleId,
      roleName,
      isPrimary: true, // their only site, so it is their landing site
      startDate: new Date(),
      endDate: null,
      grantedBy: "migration:02-backfill",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  console.log(`Processed:        ${processed}`);
  console.log(`Assignments made: ${created}`);
  console.log(`Already assigned: ${skipped}`);

  if (missingRole.length > 0) {
    // Not fatal — the assignment still records the role NAME, which is what
    // permission lookups use today. Worth surfacing because it means a user
    // references a role that no longer exists.
    console.log(`\n⚠ ${missingRole.length} user(s) reference a role with no matching role document:`);
    missingRole.slice(0, 20).forEach((m) => console.log(`   - ${m}`));
    if (missingRole.length > 20) console.log(`   … and ${missingRole.length - 20} more`);
  }

  if (!DRY_RUN) {
    const unassigned = await userCol.countDocuments({
      ...userFilter,
      _id: { $nin: await assignCol.distinct("userId", { endDate: null }) },
    });
    if (unassigned > 0) {
      throw new Error(`POST-CONDITION FAILED: ${unassigned} user(s) still have no site assignment.`);
    }
    console.log(`\nOK — every ${INCLUDE_INACTIVE ? "" : "active "}user has a site assignment.`);
  }

  if (DRY_RUN) console.log("\n--dry-run set — no changes written.");
  await mongo.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
