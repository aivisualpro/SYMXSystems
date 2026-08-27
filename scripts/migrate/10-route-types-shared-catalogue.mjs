#!/usr/bin/env node
/**
 * Phase 3e — route types become a shared catalogue with per-station times.
 *
 * The route types are the same everywhere: a "Route" is a Route at any
 * station. Only the start time differs.
 *
 * The earlier design cloned the whole catalogue per station, and that was
 * wrong in a way that showed up immediately — a new station started with
 * NO route types, so it could not generate a schedule at all, and
 * thereafter adding a type meant adding it three times and letting the
 * copies drift.
 *
 * This migration:
 *   1. Merges any per-station clones back into one option per NAME,
 *      folding each clone's startTime and theoryHrs into stations[].
 *   2. Clears siteId, making the catalogue organization-level.
 *   3. Replaces the {siteId,name} index with a global unique on name.
 *
 * The DEFAULT station's copy wins for the shared values, since that is
 * the one that has been in real use.
 *
 * Idempotent.
 *
 * Usage:
 *   node scripts/migrate/10-route-types-shared-catalogue.mjs --dry-run
 *   node scripts/migrate/10-route-types-shared-catalogue.mjs
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "10-route-types-shared-catalogue" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();
  const col = db.collection("SYMXRouteTypes");

  const sites = await db.collection("SYMXSites").find({}).toArray();
  const codeOf = new Map(sites.map((s) => [String(s._id), s.code]));
  const defaultSite = sites.find((s) => s.isDefault);
  if (!defaultSite) throw new Error("No default station found.");

  const all = await col.find({}).toArray();
  console.log(`${all.length} route type row(s) before migration\n`);

  const byName = new Map();
  for (const r of all) {
    const key = String(r.name || "").trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(r);
  }

  let merged = 0;
  let removed = 0;

  for (const [, rows] of byName) {
    // The default station's row wins for the shared values — it is the one
    // that has actually been in use, so its colour, grouping and flags are
    // the real ones rather than a clone's.
    rows.sort((a, b) => {
      const aDef = String(a.siteId || "") === String(defaultSite._id) ? 0 : 1;
      const bDef = String(b.siteId || "") === String(defaultSite._id) ? 0 : 1;
      if (aDef !== bDef) return aDef - bDef;
      return String(a._id).localeCompare(String(b._id));
    });
    const keep = rows[0];
    const dupes = rows.slice(1);

    const stations = Array.isArray(keep.stations) ? [...keep.stations] : [];
    const addOverride = (siteId, startTime, theoryHrs) => {
      if (!siteId) return;
      if (stations.some((s) => String(s.siteId) === String(siteId))) return;
      stations.push({
        siteId,
        startTime: startTime || "",
        theoryHrs: theoryHrs || 0,
      });
    };

    // Each clone's own times become that station's override.
    for (const d of dupes) addOverride(d.siteId, d.startTime, d.theoryHrs);
    // And the kept row's station keeps its own times explicitly, so the
    // shared default can later be changed without silently moving it.
    addOverride(keep.siteId, keep.startTime, keep.theoryHrs);

    const summary = stations
      .map((s) => `${codeOf.get(String(s.siteId)) || "?"}@${s.startTime || "—"}`)
      .join(" ");
    console.log(
      `  ${String(keep.name).padEnd(22)} ${dupes.length ? `merge ${dupes.length}  ` : "        "}${summary}`
    );
    merged++;
    removed += dupes.length;

    if (DRY_RUN) continue;

    await col.updateOne(
      { _id: keep._id },
      { $set: { stations, updatedAt: new Date() }, $unset: { siteId: "" } }
    );
    if (dupes.length) {
      await col.deleteMany({ _id: { $in: dupes.map((d) => d._id) } });
    }
  }

  if (!DRY_RUN) {
    const indexes = await col.indexes();
    const perStation = indexes.find(
      (i) => Object.keys(i.key).join(",") === "siteId,name"
    );
    if (perStation) {
      await col.dropIndex(perStation.name);
      console.log(`\n  dropped per-station index ${perStation.name}`);
    }
    const globalUnique = indexes.find(
      (i) => i.unique && Object.keys(i.key).join(",") === "name"
    );
    if (!globalUnique) {
      await col.createIndex({ name: 1 }, { unique: true });
      console.log("  created global unique index on name");
    }
  }

  console.log(
    DRY_RUN
      ? `\nWould keep ${merged} route type(s), remove ${removed} clone(s).\n--dry-run set — nothing written.`
      : `\n✓ ${merged} shared route type(s), ${removed} clone(s) removed.\n\n` +
        "  Every station now has the full catalogue. Start times are per\n" +
        "  station and editable in Admin > Settings > Default Routes."
  );

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
