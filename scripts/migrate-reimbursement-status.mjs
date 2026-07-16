#!/usr/bin/env node
/**
 * One-time migration for the reimbursement lifecycle redesign (July 2026).
 * Existing records used a flat, unenforced 5-value status string set by the
 * old admin page: "Pending" | "Unpaid" | "Approved" | "Rejected" | "Paid".
 * The new model (lib/models/SymxReimbursement.ts) uses a proper enum:
 * "pending" | "approved" | "denied" | "queued_for_payroll" | "paid".
 *
 * Mapping applied:
 *   Pending  -> pending
 *   Approved -> approved   (reviewed, awaiting payment)
 *   Unpaid   -> approved   (legacy status that meant the same thing in
 *                           practice — reviewed but not yet paid)
 *   Rejected -> denied
 *   Paid     -> paid       (also backfills paidDate from updatedAt/date if
 *                           paidDate is missing, so paid-history KPIs work)
 *   anything else / missing -> pending (safe default, logged)
 *
 * Also backfills `source: "admin"` on any pre-existing record that has no
 * source at all (everything before this redesign came in through the admin
 * page or the CSV importer, never the public form, which didn't exist yet).
 *
 *   node scripts/migrate-reimbursement-status.mjs             # dry run
 *   node scripts/migrate-reimbursement-status.mjs --confirm    # applies it
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

const STATUS_MAP = {
  Pending: "pending",
  Approved: "approved",
  Unpaid: "approved",
  Rejected: "denied",
  Paid: "paid",
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not found in .env");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const reimbursements = db.collection("symxreimbursements");

  const all = await reimbursements.find({}).toArray();
  console.log(`${all.length} reimbursement record(s) found.\n`);

  const plan = [];
  for (const doc of all) {
    const set = {};
    const currentStatus = doc.status;
    const isAlreadyNewEnum = ["pending", "approved", "denied", "queued_for_payroll", "paid"].includes(
      currentStatus
    );

    if (!isAlreadyNewEnum) {
      const mapped = STATUS_MAP[currentStatus] || "pending";
      set.status = mapped;
      if (mapped === "paid" && !doc.paidDate) {
        set.paidDate = doc.updatedAt || doc.date || doc.createdAt || new Date();
      }
    }

    if (!doc.source) set.source = "admin";

    if (Object.keys(set).length > 0) {
      plan.push({ _id: doc._id, from: currentStatus, set });
    }
  }

  console.log(`${plan.length} record(s) need updating.`);
  const unrecognized = all.filter(
    (d) => d.status && !STATUS_MAP[d.status] && !["pending", "approved", "denied", "queued_for_payroll", "paid"].includes(d.status)
  );
  if (unrecognized.length > 0) {
    console.log(`\n${unrecognized.length} record(s) had an unrecognized status, defaulted to "pending":`);
    for (const d of unrecognized) console.log(`  - ${d._id}: "${d.status}"`);
  }

  if (!CONFIRM) {
    console.log("\nDry run only — no records updated.");
    console.log("Re-run with --confirm added to apply.");
    await client.close();
    return;
  }

  let updated = 0;
  for (const item of plan) {
    const result = await reimbursements.updateOne({ _id: item._id }, { $set: item.set });
    if (result.modifiedCount > 0) updated++;
  }

  console.log(`\nMigrated ${updated} record(s).`);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
