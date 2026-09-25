#!/usr/bin/env node
/**
 * Backfill for incidents created with no siteId at all.
 *
 * The incident POST handler never stamped siteId on create — every
 * incident, regardless of which station was active when it was reported,
 * saved with siteId completely unset. The list page's includeUnassigned
 * fallback then surfaced those records only when the org's DEFAULT
 * station (DFO2) was the one being viewed, so a DXC8 incident appeared to
 * "disappear" from DXC8 and show up under DFO2 instead. The API route is
 * fixed to stamp siteId going forward; this repairs incidents that
 * already saved before that fix.
 *
 * Best-effort inference: siteId = the reporting employee's CURRENT
 * primarySiteId (via transporterId). This is a reasonable guess (an
 * incident is almost always reported from the driver's own station) but
 * not guaranteed correct if that employee has since transferred stations
 * — review the printed list before running live, and fix any wrong ones
 * by hand afterward if needed (there's no siteId edit field in the UI
 * yet; ask if you need one).
 *
 * Never touches incidents that already have a siteId.
 *
 * Usage:
 *   node scripts/migrate/19-backfill-incident-siteid.mjs --dry-run
 *   node scripts/migrate/19-backfill-incident-siteid.mjs --target=production --i-know-this-is-production
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "19-backfill-incident-siteid" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();

  const sites = await db.collection("SYMXSites").find({}).project({ code: 1, name: 1 }).toArray();
  const siteLabel = (id) => {
    const s = sites.find((x) => String(x._id) === String(id));
    return s ? `${s.code} — ${s.name}` : "unknown station";
  };

  const orphans = await db
    .collection("SymxIncidents")
    .find({ siteId: { $exists: false } })
    .toArray();

  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Found ${orphans.length} incident(s) with no siteId.\n`);

  let fixed = 0, skipped = 0;

  for (const inc of orphans) {
    const tid = (inc.transporterId || "").trim().toUpperCase();
    const emp = tid
      ? await db.collection("SYMXEmployees").findOne({ transporterId: tid }, { projection: { primarySiteId: 1, firstName: 1, lastName: 1 } })
      : null;

    if (!emp?.primarySiteId) {
      console.log(`  SKIP     ${inc._id}  transporterId "${tid || "(none)"}" — no employee/station match, needs manual fix.`);
      skipped++;
      continue;
    }

    console.log(`  BACKFILL ${inc._id}  ${emp.firstName || ""} ${emp.lastName || ""} -> ${siteLabel(emp.primarySiteId)}`);
    if (!DRY_RUN) {
      await db.collection("SymxIncidents").updateOne(
        { _id: inc._id },
        { $set: { siteId: emp.primarySiteId } }
      );
    }
    fixed++;
  }

  console.log(`\n${fixed} backfilled, ${skipped} skipped (need manual review).`);
  if (DRY_RUN) console.log("Re-run without --dry-run (with --target=production --i-know-this-is-production) to apply.");

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
