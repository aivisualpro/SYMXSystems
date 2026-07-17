#!/usr/bin/env node
/**
 * Team metrics report: most packages delivered, most stops, and safety
 * infractions logged, for a given date range.
 *
 * This sandbox has no network route to the production MongoDB cluster
 * (confirmed: querySrv ECONNREFUSED against the Atlas SRV record), so this
 * script can't be run from here — run it from a machine with real DB access
 * (e.g. wherever `npm run dev` / the Vercel deploy normally connects from).
 *
 * Usage:
 *   node scripts/team-metrics-report.mjs                          # defaults to 2026-06-24 .. 2026-07-30
 *   node scripts/team-metrics-report.mjs 2026-06-24 2026-07-30     # explicit range (inclusive, YYYY-MM-DD)
 *
 * Reads MONGODB_URI from .env. Writes a plain-text summary to stdout AND to
 * team-metrics-report.txt in the project root so it's easy to paste into
 * Slack/email or hand to me afterward to turn into a formatted doc.
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

const [, , argStart, argEnd] = process.argv;
const startStr = argStart || "2026-06-24";
const endStr = argEnd || "2026-07-30";
const TOP_N = 15;

function fmtInt(n) {
  return n.toLocaleString("en-US");
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not found in .env");

  const start = new Date(startStr + "T00:00:00.000Z");
  const end = new Date(endStr + "T23:59:59.999Z");
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid date(s). Use YYYY-MM-DD YYYY-MM-DD");
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const routes = db.collection("SYMXRoutes");
  const employees = db.collection("SYMXEmployees");
  const writeups = db.collection("SYMXWriteups");

  // ── Employee name lookup ──
  const empList = await employees.find({}, { projection: { transporterId: 1, firstName: 1, lastName: 1, status: 1 } }).toArray();
  const nameMap = new Map(empList.map(e => [e.transporterId, `${e.firstName || ""} ${e.lastName || ""}`.trim() || e.transporterId]));
  const statusMap = new Map(empList.map(e => [e.transporterId, e.status || ""]));

  // ── Packages / Stops per employee ──
  const routeDocs = await routes
    .find(
      { date: { $gte: start, $lte: end } },
      { projection: { transporterId: 1, packageCount: 1, stopCount: 1, routeNumber: 1, date: 1 } }
    )
    .toArray();

  const perEmp = new Map(); // transporterId -> { packages, stops, routes }
  for (const r of routeDocs) {
    if (!r.transporterId) continue;
    const cur = perEmp.get(r.transporterId) || { packages: 0, stops: 0, routes: 0 };
    cur.packages += Number(r.packageCount) || 0;
    cur.stops += Number(r.stopCount) || 0;
    cur.routes += 1;
    perEmp.set(r.transporterId, cur);
  }

  const rows = Array.from(perEmp.entries()).map(([tid, v]) => ({
    transporterId: tid,
    name: nameMap.get(tid) || tid,
    status: statusMap.get(tid) || "unknown",
    ...v,
  }));

  const byPackages = [...rows].sort((a, b) => b.packages - a.packages).slice(0, TOP_N);
  const byStops = [...rows].sort((a, b) => b.stops - a.stops).slice(0, TOP_N);

  const teamTotals = rows.reduce(
    (acc, r) => ({ packages: acc.packages + r.packages, stops: acc.stops + r.stops, routes: acc.routes + r.routes }),
    { packages: 0, stops: 0, routes: 0 }
  );

  // ── Safety infractions ──
  const safetyDocs = await writeups
    .find(
      {
        incidentDate: { $gte: start, $lte: end },
        $or: [
          { categoryLabel: { $regex: "safety", $options: "i" } },
          { subCategory: { $regex: "safety", $options: "i" } },
        ],
      },
      { projection: { employeeName: 1, transporterId: 1, categoryLabel: 1, subCategory: 1, incidentDate: 1, warningLevel: 1, status: 1 } }
    )
    .sort({ incidentDate: 1 })
    .toArray();

  // ── Build report ──
  const lines = [];
  lines.push(`TEAM METRICS — ${startStr} to ${endStr}`);
  lines.push("=".repeat(60));
  lines.push("");
  lines.push(`Based on ${fmtInt(routeDocs.length)} route records across ${fmtInt(rows.length)} employees.`);
  lines.push("");

  lines.push("TEAM TOTALS");
  lines.push("-".repeat(60));
  lines.push(`Packages delivered: ${fmtInt(teamTotals.packages)}`);
  lines.push(`Stops:              ${fmtInt(teamTotals.stops)}`);
  lines.push(`Routes run:         ${fmtInt(teamTotals.routes)}`);
  lines.push("");

  lines.push(`MOST PACKAGES DELIVERED (top ${TOP_N})`);
  lines.push("-".repeat(60));
  byPackages.forEach((r, i) => {
    lines.push(`${String(i + 1).padStart(2)}. ${r.name.padEnd(28)} ${fmtInt(r.packages).padStart(8)} pkgs   (${r.routes} routes)`);
  });
  lines.push("");

  lines.push(`MOST STOPS (top ${TOP_N})`);
  lines.push("-".repeat(60));
  byStops.forEach((r, i) => {
    lines.push(`${String(i + 1).padStart(2)}. ${r.name.padEnd(28)} ${fmtInt(r.stops).padStart(8)} stops  (${r.routes} routes)`);
  });
  lines.push("");

  lines.push(`SAFETY INFRACTIONS (${safetyDocs.length} found — matched on "safety" in category/sub-category)`);
  lines.push("-".repeat(60));
  if (safetyDocs.length === 0) {
    lines.push("None found matching \"safety\" in category or sub-category for this range.");
    lines.push("(If your safety write-ups use a different label, tell me the exact wording");
    lines.push(" and I'll adjust the match.)");
  } else {
    for (const w of safetyDocs) {
      const d = w.incidentDate ? new Date(w.incidentDate).toISOString().split("T")[0] : "?";
      const name = w.employeeName || nameMap.get(w.transporterId) || w.transporterId;
      lines.push(`${d}  ${name.padEnd(28)} ${(w.categoryLabel || "").padEnd(20)} ${w.subCategory || ""}  [${w.warningLevel || ""}/${w.status || ""}]`);
    }
  }
  lines.push("");
  lines.push("=".repeat(60));
  lines.push("Generated " + new Date().toISOString());

  const report = lines.join("\n");
  console.log(report);

  const outPath = path.join(rootDir, "team-metrics-report.txt");
  fs.writeFileSync(outPath, report, "utf-8");
  console.log(`\n(Also written to ${outPath})`);

  await client.close();
}

main().catch(err => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
