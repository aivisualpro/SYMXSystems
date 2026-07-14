#!/usr/bin/env node
// Read-only diagnostic — lists active employees with no pay rate on file
// (rate missing, null, or 0). Used to find gaps before/after making `rate`
// a required field on the Employee model.
//
// Usage:
//   node scripts/check-missing-rate.mjs
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

async function main() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db();
  const employees = db.collection("symxemployees");

  const missing = await employees
    .find({
      status: "Active",
      $or: [{ rate: { $exists: false } }, { rate: null }, { rate: 0 }],
    })
    .project({ firstName: 1, lastName: 1, eeCode: 1, transporterId: 1, rate: 1 })
    .toArray();

  console.log(`${missing.length} active employee(s) with no pay rate on file:\n`);
  missing.forEach((m) =>
    console.log(` - ${m.firstName} ${m.lastName} (EE Code: ${m.eeCode || "none"}, Transporter ID: ${m.transporterId || "none"})`)
  );

  await mongo.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
