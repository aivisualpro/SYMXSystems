#!/usr/bin/env node
// Read-only diagnostic — for a given list of employee names (or all employees if none
// given), shows what's on file for eeCode / transporterId / badgeNumber / status. Useful
// for tracking down why a Paycom EE Code didn't match during Punch Audit Report import.
//
// Usage:
//   node scripts/check-eecode-mapping.mjs "Hector Alvarez" "Raquel Silva"
//   node scripts/check-eecode-mapping.mjs            (lists ALL active employees missing eeCode)
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

const names = process.argv.slice(2);

async function main() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db();
  // Mongoose default collection name for model "SymxEmployee" is "symxemployees"
  const employees = db.collection("symxemployees");

  if (names.length > 0) {
    for (const fullName of names) {
      const parts = fullName.trim().split(/\s+/);
      const first = parts[0];
      const last = parts.slice(1).join(" ");
      const matches = await employees
        .find({
          firstName: { $regex: `^${first}$`, $options: "i" },
          lastName: { $regex: `^${last}$`, $options: "i" },
        })
        .project({ firstName: 1, lastName: 1, eeCode: 1, transporterId: 1, badgeNumber: 1, status: 1 })
        .toArray();

      console.log(`\n=== "${fullName}" ===`);
      if (matches.length === 0) {
        console.log("  No employee found with this name in SYMX.");
      } else {
        matches.forEach((m) =>
          console.log(
            `  status=${m.status} eeCode=${JSON.stringify(m.eeCode)} transporterId=${JSON.stringify(m.transporterId)} badgeNumber=${JSON.stringify(m.badgeNumber)}`
          )
        );
      }
    }
  } else {
    const missing = await employees
      .find({ status: "Active", $or: [{ eeCode: { $exists: false } }, { eeCode: "" }, { eeCode: null }] })
      .project({ firstName: 1, lastName: 1, eeCode: 1, transporterId: 1 })
      .toArray();
    console.log(`${missing.length} active employee(s) with no eeCode on file:\n`);
    missing.forEach((m) => console.log(` - ${m.firstName} ${m.lastName} (transporterId: ${m.transporterId || "none"})`));
  }

  await mongo.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
