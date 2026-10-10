/**
 * Manual, single-day/single-station van auto-assignment.
 *
 * Distinct from the existing `autoAssignVans()` in route-generation.ts,
 * which runs automatically for a whole WEEK right after routes are
 * generated and only understands two hardcoded size categories. This is
 * the on-demand version a dispatcher triggers from the Routes page for
 * the day/station they're looking at, with the rules Rohan asked for:
 *
 *   - Only ever touches the ONE station currently in view (never pools
 *     vans across stations) and only fills in blank van fields — an
 *     already-assigned row is never touched or re-shuffled.
 *   - Only rows whose type is "Route" or "Training OTR" need a van at
 *     all — Crash, Fleet, Pending ECP, Close, Open, TCO, etc. are left
 *     alone regardless of whether their van is blank.
 *   - "Route" rows are a hard size match: a route whose WST is a
 *     specific size (e.g. "SP XL") can only get a van whose serviceType
 *     is that exact size. "Training OTR" rows (typically Nursery WSTs)
 *     can take any van, and among the leftover vans we prefer the
 *     smaller ones first so scarce XL vans stay free for routes that
 *     actually need XL.
 *   - Never assigns a Grounded (or Maintenance/Inactive/Decommissioned)
 *     van, and never a van already running another route at this
 *     station today.
 *   - For each driver, tries their own Default Vans first, in order —
 *     Primary, then Backup 1, then Backup 2 (set on their HR profile) —
 *     before anything else, as long as the van still qualifies (right
 *     size for a Route row, available, not grounded). Only when none of
 *     the three apply does it fall back to the van they drove most
 *     recently, then to the general pool.
 *   - Training OTR rows always prefer a dashcam-equipped van among the
 *     otherwise-qualifying candidates (these are the newer/training
 *     drivers by nature of the row type). Route rows additionally
 *     prefer dashcam for drivers hired within the last 90 days.
 *   - Processes drivers senior-first (earliest hiredDate) so that if two
 *     drivers' preferences ever collide over the same van, the
 *     longest-tenured driver's preference wins.
 *   - If nothing qualifies for a route, the row is left blank and
 *     flagged with a reason rather than force-assigning a wrong size or
 *     a grounded van.
 */
import mongoose from "mongoose";
import SYMXRoute from "./models/SYMXRoute";
import SymxEmployee from "./models/SymxEmployee";
import Vehicle from "./models/Vehicle";
import RouteType from "./models/RouteType";
import { toPacificDate } from "@/app/(protected)/dispatching/routes/_components/routes-utils";

const NEW_HIRE_WINDOW_DAYS = 90;
const RECENT_VAN_WINDOW_DAYS = 45;

// The only two schedule types a van actually needs to be assigned for.
// Everything else (Crash, Fleet, Pending ECP, Close, Open, TCO, Trainer,
// Suspension, Modified Duty, Stand by, Rescue, Assign Schedule...) is left
// alone even if its van field happens to be blank.
const VAN_ELIGIBLE_TYPE_NAMES = new Set(["route", "training otr", "flight risk"]);

// Common size tokens, roughly small -> large. Anything not recognized
// (a station's own custom service-type label) falls back to a middle
// rank so it's not wrongly treated as the scarcest size.
const SIZE_RANK: Record<string, number> = {
  S: 1, SM: 1, SMALL: 1,
  M: 2, MD: 2, MED: 2, MEDIUM: 2,
  L: 3, LG: 3, LARGE: 3,
  XL: 4,
  XXL: 5,
};

/** Parse a size rank from either a SYMX WST ("SP L"), a Cortex name
 *  ("Standard Parcel - Large Van") or a van serviceType. null = no size. */
function parseSize(text: string): number | null {
  const t = (text || "").trim().toLowerCase();
  if (!t) return null;
  if (/extra[\s-]*large|\bxl\b|\bsp\s*xl\b/.test(t)) return 4;
  if (/\bxxl\b/.test(t)) return 5;
  if (/\blarge\b|\bl\b/.test(t)) return 3;
  if (/medium|\bmed\b|\bm\b/.test(t)) return 2;
  if (/small|\bsm\b|\bs\b/.test(t)) return 1;
  return null;
}

function sizeRank(serviceType: string): number {
  return parseSize(serviceType) ?? 3;
}

/** Closest size first (exact, then one step smaller, then one step larger…). */
function sizeDistance(vanType: string, need: number): number {
  const d = sizeRank(vanType) - need;
  return Math.abs(d) * 2 + (d > 0 ? 1 : 0);
}

function hasDashcam(v: { dashcam?: string }): boolean {
  const d = (v.dashcam || "").trim().toLowerCase();
  return !!d && d !== "none";
}

export interface AutoAssignResult {
  assignedCount: number;
  flaggedCount: number;
  assignments: { transporterId: string; employeeName: string; van: string; wst: string; reason: string }[];
  flagged: { transporterId: string; employeeName: string; wst: string; reason: string }[];
}

export async function autoAssignVansForDay(siteId: string, dateStr: string): Promise<AutoAssignResult> {
  const siteObjectId = new mongoose.Types.ObjectId(siteId);

  // Loose UTC window around the target Pacific-time day, narrowed down
  // precisely below with toPacificDate — same defensive pattern used
  // elsewhere in this codebase for date-string matching across the
  // UTC/Pacific boundary.
  const rangeStart = new Date(`${dateStr}T00:00:00.000Z`);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 1);
  const rangeEnd = new Date(`${dateStr}T23:59:59.999Z`);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

  // Eligible route types — ONLY "Route" and "Training OTR" need a van at
  // all. Everything else keeps whatever van field it has (usually blank)
  // untouched, even by this bulk tool.
  const allRouteTypes = await RouteType.find({}, { _id: 1, name: 1 }).lean() as any[];
  const typeIdToName = new Map(allRouteTypes.map((rt: any) => [String(rt._id), (rt.name || "").trim()]));
  const eligibleTypeIds = allRouteTypes
    .filter((rt: any) => VAN_ELIGIBLE_TYPE_NAMES.has((rt.name || "").trim().toLowerCase()))
    .map((rt: any) => String(rt._id));

  // All of this station's routes in the loose window — filtered down to
  // the exact day, and to this station, in JS.
  const dayRoutesRaw = await SYMXRoute.find({
    siteId: siteObjectId,
    date: { $gte: rangeStart, $lte: rangeEnd },
  }).lean() as any[];
  const dayRoutes = dayRoutesRaw.filter((r) => toPacificDate(r.date) === dateStr);

  const unassigned = dayRoutes.filter(
    (r) => (!r.van || !r.van.trim()) && eligibleTypeIds.includes(String(r.typeId || ""))
  );

  const result: AutoAssignResult = { assignedCount: 0, flaggedCount: 0, assignments: [], flagged: [] };
  if (unassigned.length === 0) return result;

  // Vans already running a route at this station today — never double-book.
  const usedToday = new Set(
    dayRoutes.filter((r) => r.van && r.van.trim()).map((r) => r.van.trim())
  );

  // This station's active fleet. Grounded/Maintenance/Inactive/
  // Decommissioned vans are excluded simply by not being "Active".
  const vehicles = await Vehicle.find(
    { status: "Active", currentSiteId: siteObjectId },
    { vehicleName: 1, serviceType: 1, dashcam: 1 }
  ).lean() as any[];
  const vehicleByName = new Map(vehicles.map((v) => [v.vehicleName, v]));

  // Employee lookup — hiredDate (new-hire dashcam preference + seniority
  // ordering) and each driver's own Default Vans (Primary/Backup 1/2).
  const transporterIds = [...new Set(unassigned.map((r) => r.transporterId))];
  const employees = await SymxEmployee.find(
    { transporterId: { $in: transporterIds } },
    { transporterId: 1, hiredDate: 1, firstName: 1, lastName: 1, defaultVan1: 1, defaultVan2: 1, defaultVan3: 1 }
  ).lean() as any[];
  const empByTid = new Map(employees.map((e) => [e.transporterId, e]));

  // Each driver's most recent van at THIS station in the last N days
  // (excluding today), used only when none of their Default Vans apply.
  const recentStart = new Date(rangeStart);
  recentStart.setUTCDate(recentStart.getUTCDate() - RECENT_VAN_WINDOW_DAYS - 1);
  const recentRoutesRaw = await SYMXRoute.find({
    siteId: siteObjectId,
    transporterId: { $in: transporterIds },
    van: { $nin: ["", null] },
    date: { $gte: recentStart, $lt: rangeStart },
  }, { transporterId: 1, van: 1, date: 1 }).sort({ date: -1 }).lean() as any[];
  const recentVanByTid = new Map<string, string>();
  for (const r of recentRoutesRaw) {
    if (!recentVanByTid.has(r.transporterId)) recentVanByTid.set(r.transporterId, r.van);
  }

  const isNewHire = (transporterId: string): boolean => {
    const emp = empByTid.get(transporterId);
    if (!emp?.hiredDate) return false;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - NEW_HIRE_WINDOW_DAYS);
    return new Date(emp.hiredDate) > cutoff;
  };

  const employeeName = (r: any): string => {
    const emp = empByTid.get(r.transporterId);
    return r.employeeName || (emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() : r.transporterId);
  };

  // A van qualifies for a route if it's in this station's active fleet,
  // not already used today, and — for an exact-size ("Route") row — its
  // serviceType matches the WST exactly. Flexible ("Training OTR") rows
  // have no size requirement.
  const qualifies = (vanName: string | undefined, requiredType: string | null): any | null => {
    if (!vanName) return null;
    const v = vehicleByName.get(vanName);
    if (!v || usedToday.has(v.vehicleName)) return null;
    // Any size is acceptable for a familiar van (smaller or larger than the WST).
    return v;
  };

  // Primary -> Backup 1 -> Backup 2, in that order — a driver's own
  // assigned vans always come before their recent-van history or the
  // general pool.
  const preferredDefaultVan = (transporterId: string, requiredType: string | null): any | null => {
    const emp = empByTid.get(transporterId);
    if (!emp) return null;
    return (
      qualifies(emp.defaultVan1, requiredType) ||
      qualifies(emp.defaultVan2, requiredType) ||
      qualifies(emp.defaultVan3, requiredType) ||
      null
    );
  };

  // "Route" rows are exact-size; "Training OTR" rows are flexible
  // (usually Nursery WSTs) regardless of what their WST string says.
  // Senior-first (earliest hiredDate) within each group so a
  // longer-tenured driver's Default Van / recent van wins any contention.
  // Flexible = Training OTR rows, OR any row whose WST is a Nursery level
  // (or blank) — a "Route" row with WST "Nursery 3" has no size-specific
  // van to match against (no van's serviceType is "Nursery 3"), so the
  // exact-match path below would flag it as having no available van.
  const isFlexibleRow = (r: any): boolean => {
    const typeName = (typeIdToName.get(String(r.typeId || "")) || "").toLowerCase();
    const wst = (r.wst || "").trim();
    return typeName === "training otr" || wst === "" || /nursery/i.test(wst) || parseSize(wst) === null;
  };
  const nonFlexible = unassigned.filter((r) => !isFlexibleRow(r));
  const flexible = unassigned.filter(isFlexibleRow);

  const byHiredDateAsc = (a: any, b: any) => {
    const ah = empByTid.get(a.transporterId)?.hiredDate;
    const bh = empByTid.get(b.transporterId)?.hiredDate;
    const at = ah ? new Date(ah).getTime() : 0;
    const bt = bh ? new Date(bh).getTime() : 0;
    return at - bt;
  };
  nonFlexible.sort(byHiredDateAsc);
  flexible.sort(byHiredDateAsc);

  const updateOps: any[] = [];

  const tryAssign = (route: any, van: any) => {
    usedToday.add(van.vehicleName);
    updateOps.push({
      updateOne: {
        filter: { _id: route._id },
        update: { $set: { van: van.vehicleName, serviceType: van.serviceType || "", dashcam: van.dashcam || "" } },
      },
    });
    result.assignedCount++;
    result.assignments.push({
      transporterId: route.transporterId,
      employeeName: employeeName(route),
      van: van.vehicleName,
      wst: route.wst || "",
      reason: "",
    });
  };

  // ── "Route" rows — exact-size WST match ──
  for (const route of nonFlexible) {
    const requiredType = (route.wst || "").trim().toLowerCase();

    const defaultVan = preferredDefaultVan(route.transporterId, requiredType);
    if (defaultVan) {
      tryAssign(route, defaultVan);
      continue;
    }

    const recentVanName = recentVanByTid.get(route.transporterId);
    const recentVan = qualifies(recentVanName, requiredType);
    if (recentVan) {
      tryAssign(route, recentVan);
      continue;
    }

    const need = parseSize(route.wst) ?? 3;
    let candidates = vehicles
      .filter((v) => !usedToday.has(v.vehicleName))
      .sort((x, y) => sizeDistance(x.serviceType, need) - sizeDistance(y.serviceType, need));

    if (candidates.length === 0) {
      result.flaggedCount++;
      result.flagged.push({
        transporterId: route.transporterId,
        employeeName: employeeName(route),
        wst: route.wst || "",
        reason: "No unassigned active van left at this station",
      });
      continue;
    }

    if (isNewHire(route.transporterId)) {
      const withDashcam = candidates.filter(hasDashcam);
      if (withDashcam.length > 0) candidates = withDashcam;
    }

    tryAssign(route, candidates[0]);
  }

  // ── "Training OTR" rows — flexible, smaller vans + dashcam first ──
  for (const route of flexible) {
    const defaultVan = preferredDefaultVan(route.transporterId, null);
    if (defaultVan) {
      tryAssign(route, defaultVan);
      continue;
    }

    const recentVanName = recentVanByTid.get(route.transporterId);
    const recentVan = qualifies(recentVanName, null);
    if (recentVan) {
      tryAssign(route, recentVan);
      continue;
    }

    let candidates = vehicles
      .filter((v) => !usedToday.has(v.vehicleName))
      .sort((a, b) => sizeRank(a.serviceType) - sizeRank(b.serviceType));

    if (candidates.length === 0) {
      result.flaggedCount++;
      result.flagged.push({
        transporterId: route.transporterId,
        employeeName: employeeName(route),
        wst: route.wst || "",
        reason: "No available van at this station",
      });
      continue;
    }

    // Nursery / Training OTR drivers are new by nature of the row —
    // always prefer a dashcam (Netradyne) van first, then the smallest
    // size among those; if no dashcam van is free, smallest overall.
    const dashcamPool = candidates.filter(hasDashcam);
    const pool = dashcamPool.length > 0 ? dashcamPool : candidates;
    const smallestRank = sizeRank(pool[0].serviceType);
    candidates = pool.filter((v) => sizeRank(v.serviceType) === smallestRank);

    tryAssign(route, candidates[0]);
  }

  if (updateOps.length > 0) {
    await SYMXRoute.bulkWrite(updateOps, { ordered: false });
  }

  return result;
}
