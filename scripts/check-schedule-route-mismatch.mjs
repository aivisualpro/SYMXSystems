#!/usr/bin/env node
/**
 * Read-only diagnostic — for a given driver + date, shows why a Regenerate
 * Routes click did or didn't produce a SYMXRoute document.
 *
 * Walks the exact same decision path generateRoutesForWeek uses:
 *   1. Employee record — is transporterId set, is status "Active"?
 *      (GET /api/dispatching/routes hides routes for non-active employees
 *      even if a route document exists.)
 *   2. SymxEmployeeSchedule for that date — does it have a typeId at all?
 *   3. The resolved RouteType for that typeId — routeStatus and partOf.
 *      generateRoutesForWeek only includes a schedule row if routeStatus
 *      is not "off" AND partOf includes "Dispatching". A type like
 *      "Crash" may legitimately fail this on purpose (not a bug) — this
 *      prints the RouteType's own config so you can tell the difference.
 *   4. Whether a SYMXRoute document already exists for transporterId+date
 *      at this station.
 *
 * Usage:
 *   node scripts/check-schedule-route-mismatch.mjs --name="Angel Torres" --date=2026-08-31
 *   node scripts/check-schedule-route-mismatch.mjs --name="David" --date=2026-08-31 --target=production --i-know-this-is-production
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
const dateStr = argValue("--date");

if (!nameQuery || !dateStr) {
  console.error("Usage: node scripts/check-schedule-route-mismatch.mjs --name=\"Angel Torres\" --date=YYYY-MM-DD [--target=production --i-know-this-is-production]");
  process.exit(1);
}

const env = loadEnv(rootDir);
const { uri } = resolveTargetDb(env, { scriptName: "check-schedule-route-mismatch" });

async function main() {
  const mongo = await connectWithDiagnostics(MongoClient, uri);
  const db = mongo.db();

  const nameParts = nameQuery.trim().split(/\s+/);
  const nameRegexes = nameParts.map((p) => new RegExp(p, "i"));

  const employees = await db
    .collection("SYMXEmployees")
    .find({ $and: nameRegexes.map((r) => ({ $or: [{ firstName: r }, { lastName: r }] })) })
    .project({ firstName: 1, lastName: 1, transporterId: 1, status: 1, siteId: 1 })
    .toArray();

  if (employees.length === 0) {
    console.log(`No employee matched "${nameQuery}".`);
    await mongo.close();
    return;
  }

  const dateObj = new Date(`${dateStr}T00:00:00.000Z`);

  for (const emp of employees) {
    console.log("─".repeat(64));
    console.log(`${emp.firstName} ${emp.lastName}`);
    console.log(`  transporterId: ${emp.transporterId || "(none — cannot match to a schedule/route at all)"}`);
    console.log(`  status:        ${emp.status || "(none)"}${emp.status !== "Active" ? "  ⚠ NOT Active — GET /api/dispatching/routes hides this driver's routes even if one exists" : ""}`);
    console.log(`  siteId:        ${emp.siteId || "(none)"}`);

    if (!emp.transporterId) continue;
    const tid = emp.transporterId.trim().toUpperCase();

    let sched = await db
      .collection("SYMXEmployeeSchedules")
      .findOne({ transporterId: tid, date: dateObj });

    if (!sched) {
      // Try case-insensitive / untrimmed transporterId as a fallback
      sched = await db
        .collection("SYMXEmployeeSchedules")
        .findOne({ transporterId: { $regex: `^${tid}$`, $options: "i" }, date: dateObj });
    }

    if (!sched) {
      console.log(`  Schedule for ${dateStr}: NONE FOUND (no SYMXEmployeeSchedules row for this transporterId+date at all)`);
      continue;
    }
    console.log(`  Schedule type: "${sched.type}"  typeId: ${sched.typeId || "(none)"}  siteId: ${sched.siteId || "(none)"} [${sched.siteId?.constructor?.name}]  status: ${sched.status || sched.routeStatus || "(none)"}`);

    if (!sched.typeId) {
      console.log(`  ⚠ No typeId on this schedule row — generateRoutesForWeek requires a truthy typeId, so this row is silently excluded (workingSchedules filter).`);
    } else {
      let rt = null;
      try {
        rt = await db.collection("SYMXRouteTypes").findOne({ _id: new ObjectId(sched.typeId) });
      } catch {
        console.log(`  ⚠ typeId "${sched.typeId}" is not a valid ObjectId.`);
      }
      if (!rt) {
        console.log(`  ⚠ typeId "${sched.typeId}" does not match any SYMXRouteTypes document — silently excluded.`);
      } else {
        const statusOff = (rt.routeStatus || "").toLowerCase() === "off";
        const inDispatching = Array.isArray(rt.partOf) && rt.partOf.includes("Dispatching");
        console.log(`  RouteType "${rt.name}": routeStatus="${rt.routeStatus}" partOf=[${(rt.partOf || []).join(", ")}]`);
        if (statusOff || !inDispatching) {
          console.log(`  → EXCLUDED from route generation by design: ${statusOff ? "routeStatus is Off" : ""}${statusOff && !inDispatching ? " and " : ""}${!inDispatching ? "partOf does not include Dispatching" : ""}.`);
          console.log(`    If this type SHOULD generate a route, that's a RouteType config fix (Dispatching settings), not a code bug.`);
        } else {
          console.log(`  → Eligible for route generation (routeStatus not Off, partOf includes Dispatching).`);
        }
      }
    }

    const siteIdForRoute = sched.siteId || emp.siteId;
    const route = siteIdForRoute
      ? await db.collection("SYMXRoutes").findOne({ transporterId: tid, date: dateObj, siteId: siteIdForRoute })
      : await db.collection("SYMXRoutes").findOne({ transporterId: tid, date: dateObj });

    if (!route) {
      console.log(`  SYMXRoute for ${dateStr}: NONE — Regenerate has not created one (or created one under a different siteId — see below).`);
      const anyRoute = await db.collection("SYMXRoutes").findOne({ transporterId: tid, date: dateObj });
      if (anyRoute) {
        const sameText = String(anyRoute.siteId) === String(siteIdForRoute);
        const sameType = anyRoute.siteId?.constructor?.name === siteIdForRoute?.constructor?.name;
        console.log(`  ⚠ BUT a SYMXRoute for this transporterId+date DOES exist: siteId=${anyRoute.siteId} [${anyRoute.siteId?.constructor?.name}]`);
        if (sameText && !sameType) {
          console.log(`    → SAME siteId value but DIFFERENT BSON TYPE (schedule's is ${siteIdForRoute?.constructor?.name}, route's is ${anyRoute.siteId?.constructor?.name}). This is a type mismatch, not a real cross-station collision — Mongo/Mongoose exact-match queries will never find this document because ObjectId("${siteIdForRoute}") !== "${siteIdForRoute}" as far as BSON comparison is concerned.`);
        } else if (!sameText) {
          console.log(`    → Genuinely a different siteId value — real cross-station collision (migration 12 case).`);
        }
      }
    } else {
      console.log(`  SYMXRoute for ${dateStr}: EXISTS — typeId="${route.typeId}" type resolves separately in the UI. If it's not showing on Efficiency, check the RouteType name is literally "Route" (Efficiency only displays that exact type) and the employee status above.`);
    }
  }

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
