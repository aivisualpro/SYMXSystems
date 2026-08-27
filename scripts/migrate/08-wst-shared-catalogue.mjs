#!/usr/bin/env node
/**
 * Phase 3c — WST becomes a shared catalogue priced per station.
 *
 * The selections a dispatcher sees are the same at every station: the work
 * is the same work. Only the RATE differs, because Amazon's rate cards
 * price the identical service line differently per station.
 *
 * Phase 2 stamped every WST option with siteId = DFO2, and Phase 3 would
 * have cloned the whole list to each station. That was the wrong shape:
 * three copies of one catalogue drift, and adding a WST option becomes a
 * three-place edit that is easy to do twice and forget once.
 *
 * This migration:
 *   1. Moves each option's existing `revenue` into rates[] for the station
 *      that currently owns it, so no rate is lost.
 *   2. Merges any per-station CLONES back into the single shared option,
 *      folding their revenue in as that station's rate.
 *   3. Clears siteId, making the catalogue organization-level.
 *
 * The shared `revenue` field is kept as a fallback for stations with no
 * rate of their own — a station that has not been configured should price
 * work at the default, not at zero, because zero flows silently into
 * revenue and cost-per-route figures that still look like numbers.
 *
 * Idempotent.
 *
 * Usage:
 *   node scripts/migrate/08-wst-shared-catalogue.mjs --dry-run
 *   node scripts/migrate/08-wst-shared-catalogue.mjs
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "08-wst-shared-catalogue" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();
  const col = db.collection("SYMXWSTOptions");

  const sites = await db.collection("SYMXSites").find({}).toArray();
  const codeOf = new Map(sites.map((s) => [String(s._id), s.code]));
  const defaultSite = sites.find((s) => s.isDefault);
  if (!defaultSite) throw new Error("No default station found.");

  const all = await col.find({}).toArray();
  console.log(`${all.length} WST option row(s) before migration\n`);

  // Group by wst code — clones share a code across stations.
  const byCode = new Map();
  for (const r of all) {
    if (!byCode.has(r.wst)) byCode.set(r.wst, []);
    byCode.get(r.wst).push(r);
  }

  let merged = 0;
  let seeded = 0;
  let removed = 0;

  for (const [code, rows] of byCode) {
    // Keep the DFO2-owned row where there is one, else the oldest — the
    // original rather than a clone, so sortOrder and amazonServiceType are
    // the values someone actually chose.
    rows.sort((a, b) => {
      const aDef = String(a.siteId || "") === String(defaultSite._id) ? 0 : 1;
      const bDef = String(b.siteId || "") === String(defaultSite._id) ? 0 : 1;
      if (aDef !== bDef) return aDef - bDef;
      return String(a._id).localeCompare(String(b._id));
    });
    const keep = rows[0];
    const dupes = rows.slice(1);

    // Build the rates array: existing entries, plus one per row's own
    // station carrying that row's revenue.
    const rates = Array.isArray(keep.rates) ? [...keep.rates] : [];
    const upsertRate = (siteId, revenue) => {
      if (!siteId || typeof revenue !== "number") return;
      const i = rates.findIndex((r) => String(r.siteId) === String(siteId));
      if (i === -1) rates.push({ siteId, revenue });
    };

    upsertRate(keep.siteId, keep.revenue);
    for (const d of dupes) upsertRate(d.siteId, d.revenue);

    const rateSummary = rates
      .map((r) => `${codeOf.get(String(r.siteId)) || "?"}=$${r.revenue}`)
      .join(" ");

    if (dupes.length > 0) {
      console.log(`  ${code.padEnd(24)} merging ${dupes.length} clone(s)   ${rateSummary}`);
      merged++;
      removed += dupes.length;
    } else if (rates.length > 0) {
      console.log(`  ${code.padEnd(24)} ${rateSummary}`);
      seeded++;
    }

    if (DRY_RUN) continue;

    await col.updateOne(
      { _id: keep._id },
      { $set: { rates, updatedAt: new Date() }, $unset: { siteId: "" } }
    );
    if (dupes.length > 0) {
      await col.deleteMany({ _id: { $in: dupes.map((d) => d._id) } });
    }
  }

  if (!DRY_RUN) {
    // The catalogue is shared now, so `wst` is globally unique again. The
    // per-station compound index (if an earlier run created one) would not
    // enforce that, so make sure the global one is present.
    const indexes = await col.indexes();
    const compound = indexes.find(
      (i) => Object.keys(i.key).join(",") === "siteId,wst"
    );
    if (compound) {
      await col.dropIndex(compound.name);
      console.log(`\n  dropped per-station index ${compound.name}`);
    }
    const globalUnique = indexes.find(
      (i) => i.unique && Object.keys(i.key).join(",") === "wst"
    );
    if (!globalUnique) {
      await col.createIndex({ wst: 1 }, { unique: true });
      console.log("  created global unique index on wst");
    }
  }

  console.log(
    DRY_RUN
      ? `\nWould merge ${merged}, seed ${seeded}, remove ${removed} clone row(s).\n--dry-run set — nothing written.`
      : `\n✓ Shared catalogue: ${byCode.size} option(s), ${removed} clone(s) removed.\n\n` +
        "  Set each station's rates with:\n" +
        "    node scripts/config/wst-rates.mjs --list"
  );

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
