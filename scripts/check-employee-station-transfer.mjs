#!/usr/bin/env node
/**
 * Read-only diagnostic — for an employee who was just moved to a new home
 * station, shows why their schedule at the new station is/isn't populated.
 *
 * Two separate systems have to line up for a transfer to produce a visible
 * schedule:
 *   1. SymxAvailableWeeks is scoped PER STATION (see lib/models/SymxAvailableWeek.ts).
 *      A station that has never had "Generate week" run for a given week
 *      has no row there — and syncEmployeeSchedules() only fills in weeks
 *      that already exist at the destination station. It does not invent
 *      new weeks.
 *   2. Old schedule rows are NOT moved on transfer, by design (comment in
 *      app/api/admin/employees/[id]/route.ts: "write-ups, schedules and
 *      routes stay at the station where they happened"). So a driver can
 *      legitimately have rows under their OLD station's siteId for dates
 *      that already existed before the move, while having nothing yet
 *      under the new station.
 *
 * This prints, for the matched employee:
 *   - their current primarySiteId (station)
 *   - whether that station has SymxAvailableWeeks rows for this week and
 *     the next 2 weeks
 *   - where their SymxEmployeeSchedules rows actually live (grouped by
 *     siteId) across a -7..+21 day window from today
 *
 * Usage:
 *   node scripts/check-employee-station-transfer.mjs --name="Jesse Hernandez"
 *   node scripts/check-employee-station-transfer.mjs --name="Jesse Hernandez" --target=production --i-know-this-is-production
 */
import { MongoClient, ObjectId } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, resolveTargetDb, connectWithDiagnostics } from "./lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function argValue(flag) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

const nameQuery = argValue("--name");
if (!nameQuery) {
  console.error(
    'Usage: node scripts/check-employee-station-transfer.mjs --name="Jesse Hernandez" [--target=production --i-know-this-is-production]'
  );
  process.exit(1);
}

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "check-employee-station-transfer" });

// ── Same week-key math as lib/schedule-generation.ts, duplicated here so
// this script has no dependency on the Next.js/TS build. ──
function getWeekDates(yearWeek) {
  const match = yearWeek.match(/(\d{4})-W(\d{2})/);
  if (!match) throw new Error("Invalid yearWeek format");
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Day = jan1.getUTCDay();
  const firstSunday = new Date(jan1);
  firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
  const weekSunday = new Date(firstSunday);
  weekSunday.setUTCDate(firstSunday.getUTCDate() + (week - 1) * 7);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekSunday);
    d.setUTCDate(weekSunday.getUTCDate() + i);
    dates.push(d);
  }
  return dates;
}
function getTodayPacific() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}
function getCurrentYearWeek() {
  const todayStr = getTodayPacific();
  const date = new Date(todayStr + "T00:00:00.000Z");
  const dayOfWeek = date.getUTCDay();
  const sundayOfThisWeek = new Date(date);
  sundayOfThisWeek.setUTCDate(date.getUTCDate() - dayOfWeek);
  const year = sundayOfThisWeek.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Day = jan1.getUTCDay();
  const firstSunday = new Date(jan1);
  firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
  const diffMs = sundayOfThisWeek.getTime() - firstSunday.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  const weekNum = Math.floor(diffDays / 7) + 1;
  return `${year}-W${weekNum.toString().padStart(2, "0")}`;
}
function getNextYearWeek(yearWeek) {
  const match = yearWeek.match(/(\d{4})-W(\d{2})/);
  let year = parseInt(match[1]);
  let week = parseInt(match[2]) + 1;
  if (week > 52) { year++; week = 1; }
  return `${year}-W${String(week).padStart(2, "0")}`;
}

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();

  const nameParts = nameQuery.trim().split(/\s+/);
  const nameRegexes = nameParts.map((p) => new RegExp(p, "i"));

  const employees = await db
    .collection("SYMXEmployees")
    .find({ $and: nameRegexes.map((r) => ({ $or: [{ firstName: r }, { lastName: r }] })) })
    .project({
      firstName: 1, lastName: 1, transporterId: 1, status: 1, primarySiteId: 1,
      hiredDate: 1, terminationDate: 1, resignationDate: 1,
    })
    .toArray();

  if (employees.length === 0) {
    console.log(`No employee matched "${nameQuery}".`);
    await mongo.close();
    return;
  }

  const sites = await db.collection("SYMXSites").find({}).project({ code: 1, name: 1 }).toArray();
  const siteById = new Map(sites.map((s) => [String(s._id), s]));
  const siteLabel = (id) => {
    if (!id) return "(none)";
    const s = siteById.get(String(id));
    return s ? `${s.code || s.name} (${id})` : `unknown site ${id}`;
  };

  const thisWeek = getCurrentYearWeek();
  const nextWeek = getNextYearWeek(thisWeek);
  const weekAfter = getNextYearWeek(nextWeek);
  const weeksToCheck = [thisWeek, nextWeek, weekAfter];

  for (const emp of employees) {
    console.log("─".repeat(70));
    console.log(`${emp.firstName} ${emp.lastName}`);
    console.log(`  transporterId: ${emp.transporterId || "(none)"}`);
    console.log(`  status:        ${emp.status || "(none)"}`);
    console.log(`  primarySiteId: ${siteLabel(emp.primarySiteId)}`);

    if (!emp.transporterId) {
      console.log(`  ⚠ No transporterId — cannot have a schedule at all.`);
      continue;
    }
    if (!emp.primarySiteId) {
      console.log(`  ⚠ No home station set — syncEmployeeSchedules skips with "no home station set".`);
      continue;
    }

    // 1. Does the destination station have available weeks?
    console.log(`\n  SymxAvailableWeeks at ${siteLabel(emp.primarySiteId)}:`);
    for (const wk of weeksToCheck) {
      const row = await db.collection("SymxAvailableWeeks").findOne({
        siteId: new ObjectId(emp.primarySiteId),
        week: wk,
      });
      console.log(`    ${wk}: ${row ? "exists ✓" : "MISSING — sync will skip this week entirely until someone generates it at this station"}`);
    }

    // 2. Where do this employee's schedule rows actually live right now?
    const dates = getWeekDates(thisWeek);
    const rangeStart = new Date(dates[0]);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - 7);
    const rangeEnd = new Date(dates[0]);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 21);

    const rows = await db
      .collection("SYMXEmployeeSchedules")
      .find({ transporterId: emp.transporterId, date: { $gte: rangeStart, $lt: rangeEnd } })
      .project({ date: 1, siteId: 1, yearWeek: 1, typeId: 1 })
      .sort({ date: 1 })
      .toArray();

    console.log(`\n  SYMXEmployeeSchedules rows, ${rangeStart.toISOString().slice(0, 10)} to ${rangeEnd.toISOString().slice(0, 10)} (${rows.length} total):`);
    if (rows.length === 0) {
      console.log(`    NONE FOUND at all in this window, at any station.`);
    } else {
      const bySite = new Map();
      for (const r of rows) {
        const key = String(r.siteId || "(none)");
        if (!bySite.has(key)) bySite.set(key, []);
        bySite.get(key).push(r);
      }
      for (const [siteKey, siteRows] of bySite) {
        const label = siteKey === "(none)" ? "(no siteId on row)" : siteLabel(siteRows[0].siteId);
        const isCurrentStation = String(emp.primarySiteId) === siteKey;
        console.log(`    ${label}${isCurrentStation ? "  ← current home station" : "  ← OLD/other station, left in place by design"}: ${siteRows.length} row(s), dates ${siteRows[0].date.toISOString().slice(0,10)}..${siteRows[siteRows.length-1].date.toISOString().slice(0,10)}`);
      }
    }
  }

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
