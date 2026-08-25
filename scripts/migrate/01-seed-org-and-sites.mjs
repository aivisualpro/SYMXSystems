#!/usr/bin/env node
/**
 * Multi-site Phase 1, step 1 — seed the Organization and its Sites.
 *
 * Creates:
 *   • One Organization (SYMX — a single legal entity, all sites in California)
 *   • DFO2 — permanent, marked isDefault. Every pre-existing record backfills
 *            here, because all current data belongs to DFO2.
 *   • DXC8 — permanent, second station.
 *   • DFO3 — seasonal (peak-season station).
 *
 * The site list below is DATA, not hard-coded logic: adding a fourth station
 * means appending one entry here (or creating it in Owner > Sites once that
 * UI ships). No application code anywhere branches on a site code.
 *
 * Idempotent — re-running matches on `code` and updates rather than
 * duplicating. Safe to run against production.
 *
 * Usage:
 *   node scripts/migrate/01-seed-org-and-sites.mjs --dry-run   # preview
 *   node scripts/migrate/01-seed-org-and-sites.mjs             # apply
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

// Defaults to STAGING when STAGING_MONGODB_URI exists. Hitting production
// requires --target=production --i-know-this-is-production.
const env = loadEnv(rootDir);
const { uri: TARGET_URI } = resolveTargetDb(env, { scriptName: "01-seed-org-and-sites" });

const ORGANIZATION = {
  name: "SYMX",
  slug: "symx",
  timezone: "America/Los_Angeles", // single legal entity, all sites in CA
};

// ── Site roster ───────────────────────────────────────────────────────
// Exactly one site must carry isDefault:true — it is the backfill target
// for all existing data and the fallback for legacy code paths during the
// migration. That is DFO2, because every record in the system today
// belongs to DFO2.
const SITES = [
  {
    code: "DFO2",
    name: "DFO2",
    slug: "dfo2",
    siteType: "permanent",
    status: "active",
    isDefault: true,
  },
  {
    code: "DXC8",
    name: "DXC8",
    slug: "dxc8",
    siteType: "permanent",
    status: "active",
    isDefault: false,
  },
  {
    code: "DFO3",
    name: "DFO3",
    slug: "dfo3",
    siteType: "seasonal",
    status: "active",
    isDefault: false,
  },
];

async function main() {
  const defaults = SITES.filter((s) => s.isDefault);
  if (defaults.length !== 1) {
    throw new Error(`Exactly one site must have isDefault:true — found ${defaults.length}.`);
  }

  const mongo = new MongoClient(TARGET_URI);
  await mongo.connect();
  const db = mongo.db();
  const orgCol = db.collection("SYMXOrganizations");
  const siteCol = db.collection("SYMXSites");

  // ── Organization ──
  let org = await orgCol.findOne({ slug: ORGANIZATION.slug });
  if (org) {
    console.log(`Organization "${ORGANIZATION.name}" already exists (${org._id}) — leaving as-is.`);
  } else {
    const doc = { ...ORGANIZATION, createdAt: new Date(), updatedAt: new Date() };
    console.log(`CREATE organization: ${ORGANIZATION.name}`);
    if (!DRY_RUN) {
      const res = await orgCol.insertOne(doc);
      org = { _id: res.insertedId, ...doc };
    } else {
      org = { _id: "<dry-run>", ...doc };
    }
  }

  // ── Sites ──
  console.log("");
  for (const site of SITES) {
    const existing = await siteCol.findOne({ organizationId: org._id, code: site.code });
    if (existing) {
      console.log(`  ${site.code}: exists (${existing._id}) — leaving as-is.`);
      continue;
    }
    const doc = {
      organizationId: org._id,
      name: site.name,
      slug: site.slug,
      code: site.code,
      siteType: site.siteType,
      address: "",
      status: site.status,
      isDefault: site.isDefault,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    console.log(
      `  ${site.code}: CREATE — ${site.siteType}${site.isDefault ? ", DEFAULT (backfill target)" : ""}`
    );
    if (!DRY_RUN) await siteCol.insertOne(doc);
  }

  // ── Post-condition ──
  if (!DRY_RUN) {
    const defaultCount = await siteCol.countDocuments({ organizationId: org._id, isDefault: true });
    if (defaultCount !== 1) {
      throw new Error(
        `POST-CONDITION FAILED: expected exactly 1 default site, found ${defaultCount}. ` +
          `The backfill in step 02 depends on this — fix before continuing.`
      );
    }
    const total = await siteCol.countDocuments({ organizationId: org._id });
    console.log(`\nOK — ${total} site(s), exactly 1 marked default.`);
  }

  if (DRY_RUN) console.log("\n--dry-run set — no changes written.");
  await mongo.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
