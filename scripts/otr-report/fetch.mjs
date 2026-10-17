#!/usr/bin/env node
/**
 * READ-ONLY export for the OTR / Business Coach overrun report.
 * Only runs find() queries — it never inserts, updates or deletes anything.
 *
 *   node scripts/otr-report/fetch.mjs --station=DXC8
 *   node scripts/otr-report/fetch.mjs --station=DXC8 --target=production --i-know-this-is-production
 *
 * Writes scripts/otr-report/out/data.json. Then run analyze.mjs.
 * Window: the 4 most recent COMPLETE Sunday–Saturday weeks (Pacific).
 */
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1];
const station = (arg("station") || "").toUpperCase();

const ymd = (d) => d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
function window4() {
  const today = new Date(ymd(new Date()) + "T12:00:00Z");
  const end = new Date(today); end.setUTCDate(end.getUTCDate() - 1);
  while (end.getUTCDay() !== 6) end.setUTCDate(end.getUTCDate() - 1); // most recent Saturday before today
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 27);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "otr-report-fetch" });
const mongo = await connectWithDiagnostics(MongoClient, uri);
const db = mongo.db();
try {
  const { start, end } = window4();
  const sites = await db.collection("SYMXSites").find({}, { projection: { code: 1, name: 1 } }).toArray();
  console.log("Stations:", sites.map((s) => s.code).join(", "));
  const site = station ? sites.find((s) => String(s.code).toUpperCase() === station) : null;
  if (station && !site) throw new Error(`Station ${station} not found`);
  const S = site ? { siteId: site._id } : {};
  const dStart = new Date(start + "T00:00:00Z"), dEnd = new Date(end + "T23:59:59Z");
  console.log(`Window ${start} → ${end}${site ? " · " + site.code : " · all stations"}`);

  const routes = await db.collection("SYMXRoutes").find({ ...S, date: { $gte: dStart, $lte: dEnd } }).toArray();
  const types = await db.collection("SYMXRouteTypes").find({}, { projection: { name: 1 } }).toArray();
  const contributions = await db.collection("SYMXRouteContributions").find({ ...S, date: { $gte: start, $lte: end } }).toArray();
  const dayStats = await db.collection("SYMXRouteDayStats").find({ ...S, date: { $gte: start, $lte: end } }).toArray();

  fs.mkdirSync(path.join(__dirname, "out"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "out", "data.json"), JSON.stringify({
    window: { start, end }, station: site ? site.code : "ALL",
    sites: sites.map((s) => ({ id: String(s._id), code: s.code })),
    types: types.map((t) => ({ id: String(t._id), name: t.name })),
    routes, contributions, dayStats,
  }));
  console.log(`routes ${routes.length} · contributions ${contributions.length} · dayStats ${dayStats.length}`);
  console.log("Wrote scripts/otr-report/out/data.json — now run: node scripts/otr-report/analyze.mjs");
} finally { await mongo.close(); }
