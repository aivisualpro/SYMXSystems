#!/usr/bin/env node
/**
 * Clears ALL SymxHrTicket records (collection "symxhrtickets") — meant for
 * wiping test/demo tickets accumulated while building the public intake
 * form, before it goes live for real drivers.
 *
 * Deliberately requires a human to actually run this with --confirm.
 * Nothing is deleted by default:
 *
 *   node scripts/clear-hr-tickets.mjs             # dry run — shows count only
 *   node scripts/clear-hr-tickets.mjs --confirm    # permanently deletes all tickets
 *
 * This also resets the shared ticket-number counter (SymxHrTicketSettings.
 * lastTicketNumber) back to 0 so the next ticket created — public or
 * admin — starts numbering from #1 again, matching a clean slate. It does
 * NOT touch notificationEmails in that same settings document.
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
  const tickets = db.collection("symxhrtickets");
  const settings = db.collection("symxhrticketsettings");

  const count = await tickets.countDocuments({});
  console.log(`${count} ticket(s) currently in symxhrtickets.`);

  if (count === 0) {
    console.log("Nothing to delete.");
    await client.close();
    return;
  }

  if (!CONFIRM) {
    console.log("\nDry run only — no records deleted.");
    console.log("Re-run with --confirm added to permanently delete ALL tickets.");
    await client.close();
    return;
  }

  const result = await tickets.deleteMany({});
  console.log(`Deleted ${result.deletedCount} ticket(s).`);

  const settingsUpdate = await settings.updateMany({}, { $set: { lastTicketNumber: 0 } });
  console.log(`Reset ticket-number counter on ${settingsUpdate.matchedCount} settings doc(s) — next ticket will be #1.`);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
