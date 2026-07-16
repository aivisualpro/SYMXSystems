#!/usr/bin/env node
/**
 * One-time backfill for the new "pay" action on the HR module permission
 * matrix (lib/models/SymxAppRole.ts). requirePermission() treats a
 * genuinely-missing action key as ALLOWED (see lib/auth/require-permission.ts)
 * so simply adding `pay` to the schema with `default: false` does nothing for
 * roles that already exist in the database — their stored HR permission
 * subdocument just won't have a `pay` key at all, which resolves to allowed.
 *
 * This script writes an explicit `pay: false` onto every existing role's HR
 * permission entry, so reimbursement payment/payroll actions are opt-in only
 * — nobody gets it for free. After running this, go into Roles &
 * Permissions in the app and manually toggle "Pay" on for whichever role(s)
 * should be able to mark reimbursements paid / add them to payroll (e.g. an
 * Owner or Finance role).
 *
 *   node scripts/backfill-hr-pay-permission.mjs             # dry run
 *   node scripts/backfill-hr-pay-permission.mjs --confirm    # applies the backfill
 */
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const envFile = fs.readFileSync(path.join(rootDir, ".env"), "utf-8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([A-Z_]+)=["']?(.+?)["']?\s*$/);
  if (match) process.env[match[1]] = match[2];
}

const CONFIRM = process.argv.includes("--confirm");

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not found in .env");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const roles = db.collection("symxapproles");

  const allRoles = await roles.find({}).toArray();
  const withHr = allRoles.filter((r) => (r.permissions || []).some((p) => p.module === "HR"));

  console.log(`${allRoles.length} role(s) total, ${withHr.length} with an HR permission entry.\n`);

  for (const role of withHr) {
    const hrPerm = role.permissions.find((p) => p.module === "HR");
    const hasPayKey = hrPerm.actions && Object.prototype.hasOwnProperty.call(hrPerm.actions, "pay");
    console.log(
      `- ${role.name}: ${hasPayKey ? `already has pay=${hrPerm.actions.pay}, skipping` : "missing pay key -> will set pay=false"}`
    );
  }

  if (!CONFIRM) {
    console.log("\nDry run only — no roles updated.");
    console.log("Re-run with --confirm added to apply, then grant Pay per-role in Roles & Permissions.");
    await client.close();
    return;
  }

  let updated = 0;
  for (const role of withHr) {
    const hrPerm = role.permissions.find((p) => p.module === "HR");
    const hasPayKey = hrPerm.actions && Object.prototype.hasOwnProperty.call(hrPerm.actions, "pay");
    if (hasPayKey) continue;

    const hrIndex = role.permissions.findIndex((p) => p.module === "HR");
    const result = await roles.updateOne(
      { _id: role._id },
      { $set: { [`permissions.${hrIndex}.actions.pay`]: false } }
    );
    if (result.modifiedCount > 0) updated++;
  }

  console.log(`\nBackfilled pay=false on ${updated} role(s).`);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
