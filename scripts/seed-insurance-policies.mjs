#!/usr/bin/env node
/**
 * Seed the 14 historical insurance policy records Rohan provided.
 * Safe to re-run — upserts by policyNumber, so it won't create duplicates.
 * These are past/expired policies for reference; add current/active
 * policies yourself through the Insurance Policies page in the app.
 *
 * Usage: node scripts/seed-insurance-policies.mjs
 */
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Load .env
const envFile = fs.readFileSync(path.join(rootDir, ".env"), "utf-8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([A-Z_]+)=["']?(.+?)["']?\s*$/);
  if (match) process.env[match[1]] = match[2];
}

// Parses "MM/DD/YYYY" or "M/DD/YYYY" (both appear in the source data) into a Date.
function parseDate(str) {
  if (!str) return undefined;
  const [m, d, y] = str.split("/").map(Number);
  if (!m || !d || !y) return undefined;
  return new Date(Date.UTC(y, m - 1, d));
}

// "$1,000,000" -> 1000000
function parseMoney(str) {
  if (str === undefined || str === null || str === "") return undefined;
  const n = Number(String(str).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

const POLICIES = [
  { policyNumber: "ALA200560-25", startDate: "09/26/2021", endDate: "03/25/2022", company: "Marsh", type: "Auto", policyLimit: "$1,000,000" },
  { policyNumber: "ALA200560-26", startDate: "03/26/2022", endDate: "03/26/2023", company: "Marsh", type: "Auto", policyLimit: "$1,000,000" },
  { policyNumber: "SCV0133392301", startDate: "03/26/2023", endDate: "03/26/2024", company: "Allianz", type: "Auto", policyLimit: "$1,000,000" },
  { policyNumber: "BAP-3242883-00", startDate: "03/26/2024", endDate: "10/01/2024", company: "Aegis / Zurich", type: "Auto", policyLimit: "$1,000,000" },
  { policyNumber: "RAC9438586", startDate: "10/01/2024", endDate: "10/01/2025", company: "Aegis / AXA XL", type: "Auto", policyLimit: "$1,000,000" },
  { policyNumber: "TWC4030793", startDate: "09/30/2021", endDate: "09/30/2022", company: "AmTrust", type: "Workers Comp", policyLimit: "$1,000,000" },
  { policyNumber: "SWC1411320", startDate: "09/30/2022", endDate: "09/30/2023", company: "AmTrust", type: "Workers Comp", policyLimit: "$1,000,000" },
  { policyNumber: "1AGCA16007380", startDate: "09/30/2023", endDate: "04/27/2024", company: "Atlas", type: "Workers Comp", policyLimit: "$1,000,000" },
  { policyNumber: "WC-3242881-00", startDate: "03/26/2024", endDate: "10/01/2024", company: "Aegis / Zurich", type: "Workers Comp", policyLimit: "$1,000,000" },
  {
    policyNumber: "RWC3002317", startDate: "10/01/2024", endDate: "10/01/2025", company: "Aegis / AXA XL", type: "Workers Comp",
    policyLimit: "$1,000,000", claimsIncurred: 1500.05, claimsPaid: 1000.05, totalClaims: 2, openClaims: 0,
  },
  { policyNumber: "GLO-3242882-00", startDate: "03/26/2024", endDate: "10/01/2024", company: "Aegis / Zurich", type: "General Liability", policyLimit: "$1,000,000" },
  { policyNumber: "RGC9438807", startDate: "10/01/2024", endDate: "10/01/2025", company: "Aegis / AXA XL", type: "General Liability", policyLimit: "$1,000,000" },
  { policyNumber: "GLA800553-25", startDate: "09/26/2021", endDate: "03/25/2022", company: "Marsh", type: "General Liability", policyLimit: "$1,000,000" },
  { policyNumber: "GLA800553-26", startDate: "03/26/2022", endDate: "03/26/2023", company: "Marsh", type: "General Liability", policyLimit: "$1,000,000" },
];

async function main() {
  const mongo = new MongoClient(process.env.MONGODB_URI);
  await mongo.connect();
  const db = mongo.db();
  const col = db.collection("SYMXInsurancePolicies");

  let created = 0;
  let updated = 0;

  for (const p of POLICIES) {
    const doc = {
      policyNumber: p.policyNumber,
      startDate: parseDate(p.startDate),
      endDate: parseDate(p.endDate),
      company: p.company,
      type: p.type,
      policyLimit: parseMoney(p.policyLimit),
      claimsIncurred: p.claimsIncurred,
      claimsPaid: p.claimsPaid,
      totalClaims: p.totalClaims,
      openClaims: p.openClaims,
      createdBy: "seed-script",
    };

    const res = await col.updateOne(
      { policyNumber: p.policyNumber },
      { $set: doc, $setOnInsert: { lossRuns: [], notes: "", createdAt: new Date() } },
      { upsert: true }
    );

    if (res.upsertedCount > 0) {
      created++;
      console.log(`  + created ${p.policyNumber} (${p.company} — ${p.type})`);
    } else if (res.modifiedCount > 0) {
      updated++;
      console.log(`  ~ updated ${p.policyNumber} (${p.company} — ${p.type})`);
    } else {
      console.log(`  = unchanged ${p.policyNumber}`);
    }
  }

  console.log(`\nDone. ${created} created, ${updated} updated, ${POLICIES.length - created - updated} unchanged.`);
  console.log("These are historical/expired policies — add your current active policies through the app.");
  await mongo.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
