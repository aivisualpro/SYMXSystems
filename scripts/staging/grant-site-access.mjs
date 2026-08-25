#!/usr/bin/env node
/**
 * Grant a user access to additional stations, or company-wide access.
 *
 * Super Admins already see every station automatically, so testing the
 * switcher as a NON-super-admin needs real assignments. This creates them.
 *
 * Staging-only by design: it refuses to run against production. Production
 * grants belong in the Sites admin UI where they're reviewable, not in a
 * command that leaves no context for why access was given.
 *
 * Usage:
 *   # Add stations (keeps existing assignments)
 *   node scripts/staging/grant-site-access.mjs userc374d3@staging.local DXC8 DFO3
 *
 *   # Company-wide grant — sees every station, including future ones
 *   node scripts/staging/grant-site-access.mjs userc374d3@staging.local --org
 *
 *   # Read-only company-wide (auditor)
 *   node scripts/staging/grant-site-access.mjs userc374d3@staging.local --org --read-only
 *
 *   # Remove all extra access, back to their primary station only
 *   node scripts/staging/grant-site-access.mjs userc374d3@staging.local --reset
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, hostFromUri, dbNameFromUri, looksNonProduction, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const env = loadEnv(rootDir);

const args = process.argv.slice(2);
const email = (args[0] || "").toLowerCase();
const ORG = args.includes("--org");
const READ_ONLY = args.includes("--read-only");
const RESET = args.includes("--reset");
const siteCodes = args.slice(1).filter((a) => !a.startsWith("--")).map((s) => s.toUpperCase());

if (!email) {
  console.error("Usage: node scripts/staging/grant-site-access.mjs <email> [SITE_CODE...] [--org] [--read-only] [--reset]");
  process.exit(1);
}

async function main() {
  const uri = env.STAGING_MONGODB_URI;
  if (!uri) throw new Error("STAGING_MONGODB_URI is not set in .env");
  if (!looksNonProduction(uri)) {
    throw new Error(
      `Refusing to run: ${hostFromUri(uri)}/${dbNameFromUri(uri)} does not look like staging.\n` +
        `Production access grants belong in the Sites admin UI, where they're auditable.`
    );
  }

  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();
  const userCol = db.collection("SYMXUsers");
  const siteCol = db.collection("SYMXSites");
  const assignCol = db.collection("SYMXUserSiteAssignments");
  const grantCol = db.collection("SYMXOrgRoleGrants");
  const orgCol = db.collection("SYMXOrganizations");

  const user = await userCol.findOne({ email });
  if (!user) throw new Error(`No user with email "${email}" in ${dbNameFromUri(uri)}`);
  console.log(`User: ${user.name} (${user.AppRole})\n`);

  if (user.AppRole === "Super Admin") {
    console.log("Note: Super Admins already see every station regardless of assignments.");
    console.log("      To test the switcher as a normal user, pick a non-Super-Admin account.\n");
  }

  if (RESET) {
    const removedGrants = await grantCol.deleteMany({ userId: user._id });
    const kept = await assignCol.findOne({ userId: user._id, isPrimary: true, endDate: null });
    const removedAssignments = await assignCol.deleteMany({
      userId: user._id,
      endDate: null,
      ...(kept ? { _id: { $ne: kept._id } } : {}),
    });
    console.log(`Removed ${removedGrants.deletedCount} org grant(s) and ${removedAssignments.deletedCount} extra assignment(s).`);
    console.log(`Kept primary station: ${kept ? (await siteCol.findOne({ _id: kept.siteId }))?.code : "(none)"}`);
    await mongo.close();
    return;
  }

  if (ORG) {
    const org = await orgCol.findOne();
    if (!org) throw new Error("No organization found — run 01-seed-org-and-sites.mjs first.");
    await grantCol.deleteMany({ userId: user._id });
    await grantCol.insertOne({
      userId: user._id,
      organizationId: org._id,
      roleId: null,
      roleName: user.AppRole || "",
      scope: READ_ONLY ? "read_only_all_sites" : "all_sites",
      startDate: new Date(),
      endDate: null,
      grantedBy: "script:grant-site-access",
      reason: "Staging test grant",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(
      `Granted COMPANY-WIDE${READ_ONLY ? " (read-only)" : ""} access — sees every station, ` +
        `including any added later.`
    );
    await mongo.close();
    return;
  }

  if (siteCodes.length === 0) {
    throw new Error("Provide one or more site codes (e.g. DXC8 DFO3), or use --org / --reset.");
  }

  for (const code of siteCodes) {
    const site = await siteCol.findOne({ code });
    if (!site) {
      const all = await siteCol.find({}, { projection: { code: 1 } }).toArray();
      throw new Error(`No station "${code}". Available: ${all.map((s) => s.code).join(", ")}`);
    }
    const existing = await assignCol.findOne({ userId: user._id, siteId: site._id, endDate: null });
    if (existing) {
      console.log(`  ${code}: already assigned — skipping`);
      continue;
    }
    await assignCol.insertOne({
      userId: user._id,
      siteId: site._id,
      roleId: null,
      roleName: user.AppRole || "",
      isPrimary: false,
      startDate: new Date(),
      endDate: null,
      grantedBy: "script:grant-site-access",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`  ${code}: granted`);
  }

  const current = await assignCol.find({ userId: user._id, endDate: null }).toArray();
  const codes = [];
  for (const a of current) {
    const s = await siteCol.findOne({ _id: a.siteId });
    codes.push(`${s?.code}${a.isPrimary ? " (primary)" : ""}`);
  }
  console.log(`\nNow has access to: ${codes.join(", ")}`);
  console.log("Reload the app to see the switcher update.");

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
