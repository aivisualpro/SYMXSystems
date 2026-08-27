#!/usr/bin/env node
/**
 * Inspect and set employees' home station (primarySiteId).
 *
 * Employees created before the create path stamped a station have no
 * primarySiteId at all. An unassigned record shows at the DEFAULT station,
 * so someone added while viewing DXC8 silently appeared on DFO2's roster
 * with nothing on screen to suggest a problem.
 *
 * Usage:
 *   node scripts/config/assign-employees.mjs --list
 *   node scripts/config/assign-employees.mjs --list --station=DXC8
 *   node scripts/config/assign-employees.mjs --unassigned
 *   node scripts/config/assign-employees.mjs --station=DXC8 --names="Satinder Sadiura" --dry-run
 *   node scripts/config/assign-employees.mjs --station=DXC8 --names="Satinder Sadiura"
 *   node scripts/config/assign-employees.mjs --station=DXC8 --ids=A1B2C3,A4D5E6
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIST = args.includes("--list");
const UNASSIGNED = args.includes("--unassigned");
const arg = (k) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
};

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "assign-employees" });

const nameOf = (e) => `${e.firstName || ""} ${e.lastName || ""}`.trim();

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();
  const col = db.collection("SYMXEmployees");

  const sites = await db.collection("SYMXSites").find({}).toArray();
  const codeOf = new Map(sites.map((s) => [String(s._id), s.code]));
  const siteByCode = new Map(sites.map((s) => [s.code, s]));

  // ── Distribution ──
  if (LIST || UNASSIGNED || args.length === 0) {
    const rows = await col
      .aggregate([{ $group: { _id: "$primarySiteId", n: { $sum: 1 } } }])
      .toArray();
    console.log("\nEmployees per station:");
    for (const r of rows) {
      const label = r._id ? codeOf.get(String(r._id)) || "?" : "(unassigned)";
      console.log(`  ${label.padEnd(14)} ${r.n}`);
    }

    if (UNASSIGNED) {
      const orphans = await col
        .find(
          { $or: [{ primarySiteId: { $exists: false } }, { primarySiteId: null }] },
          { projection: { firstName: 1, lastName: 1, transporterId: 1, status: 1, createdAt: 1 } }
        )
        .sort({ createdAt: -1 })
        .toArray();
      console.log(`\n${orphans.length} employee(s) with NO station:`);
      console.log(`  These appear on the default station's roster, which is why`);
      console.log(`  someone added at another station seems to land at DFO2.\n`);
      for (const e of orphans) {
        console.log(
          `  ${nameOf(e).padEnd(28)} ${String(e.transporterId || "—").padEnd(16)} ` +
            `${String(e.status || "").padEnd(12)} ${e.createdAt ? new Date(e.createdAt).toISOString().slice(0, 10) : ""}`
        );
      }
    }

    const code = arg("station");
    if (LIST && code) {
      const site = siteByCode.get(code.toUpperCase());
      if (!site) throw new Error(`No station "${code}". Have: ${[...siteByCode.keys()].join(", ")}`);
      const list = await col
        .find({ primarySiteId: site._id }, { projection: { firstName: 1, lastName: 1, transporterId: 1, status: 1 } })
        .sort({ firstName: 1 })
        .toArray();
      console.log(`\n${list.length} employee(s) at ${site.code}:`);
      for (const e of list) {
        console.log(`  ${nameOf(e).padEnd(28)} ${String(e.transporterId || "—").padEnd(16)} ${e.status || ""}`);
      }
    }
    console.log("");
    await mongo.close();
    return;
  }

  // ── Assign ──
  const code = (arg("station") || "").toUpperCase();
  if (!code) throw new Error("--station=CODE is required. Use --list to see options.");
  const site = siteByCode.get(code);
  if (!site) throw new Error(`No station "${code}". Have: ${[...siteByCode.keys()].join(", ")}`);
  if (site.status !== "active") throw new Error(`${code} is closed (status: ${site.status}).`);

  const names = (arg("names") || "").split(",").map((n) => n.trim()).filter(Boolean);
  const ids = (arg("ids") || "").split(",").map((n) => n.trim()).filter(Boolean);
  if (names.length === 0 && ids.length === 0) {
    throw new Error('Provide --names="First Last,First Last" or --ids=TRANSPORTER1,TRANSPORTER2');
  }

  const or = [];
  if (ids.length) or.push({ transporterId: { $in: ids } });
  for (const n of names) {
    const [first, ...rest] = n.split(/\s+/);
    const last = rest.join(" ");
    // Anchored, case-insensitive: "Satinder Sadiura" must not also match
    // "Satinderpal". Escaped so a name with regex characters is literal.
    const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    or.push({
      firstName: new RegExp(`^${esc(first)}$`, "i"),
      ...(last ? { lastName: new RegExp(`^${esc(last)}$`, "i") } : {}),
    });
  }

  const found = await col.find({ $or: or }).toArray();

  // Report what was asked for but not found, rather than moving a subset and
  // reporting success — a misspelt name would otherwise pass unnoticed.
  const foundNames = new Set(found.map((e) => nameOf(e).toLowerCase()));
  const foundIds = new Set(found.map((e) => e.transporterId));
  const missing = [
    ...names.filter((n) => !foundNames.has(n.toLowerCase())),
    ...ids.filter((i) => !foundIds.has(i)),
  ];

  const already = found.filter((e) => String(e.primarySiteId || "") === String(site._id));
  const toMove = found.filter((e) => String(e.primarySiteId || "") !== String(site._id));

  console.log(`\nDestination: ${site.code} (${site.name})`);
  console.log(`Matched ${found.length}; ${toMove.length} to move, ${already.length} already there.\n`);
  for (const e of toMove) {
    const from = e.primarySiteId ? codeOf.get(String(e.primarySiteId)) || "?" : "(unassigned)";
    console.log(`  ${nameOf(e).padEnd(28)} ${String(e.transporterId || "—").padEnd(16)} ${from} → ${site.code}`);
  }
  if (missing.length) console.log(`\n⚠ ${missing.length} not found: ${missing.join(", ")}`);

  if (DRY_RUN) {
    console.log("\n--dry-run set — nothing written.");
    await mongo.close();
    process.exitCode = missing.length ? 1 : 0;
    return;
  }

  if (toMove.length > 0) {
    await col.updateMany(
      { _id: { $in: toMove.map((e) => e._id) } },
      { $set: { primarySiteId: site._id, updatedAt: new Date() } }
    );
    console.log(`\n✓ Moved ${toMove.length} employee(s) to ${site.code}.`);
    console.log(
      "  Only their home station changed. Write-ups, schedules and routes keep\n" +
        "  the station where they happened — that history is not rewritten."
    );
  }

  await mongo.close();
  process.exitCode = missing.length ? 1 : 0;
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
