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
 *   - Hard match: a route whose WST is a specific size (e.g. "SP XL")
 *     can only get a van whose serviceType is that exact size. "Nursery
 *     1/2/3" (and anything with no WST at all) can take any van, and
 *     among the leftover vans we prefer the smaller ones first so the
 *     scarce XL vans stay free for routes that actually need XL.
 *   - Never assigns a Grounded (or Maintenance/Inactive/Decommissioned)
 *     van, and never a van already running another route at this
 *     station today.
 *   - Prefers giving a driver the van they drove in the last 7 days at
 *     this station, if that van still qualifies (right size, available,
 *     not grounded) — familiarity over a cold-assigned van.
 *   - For drivers hired within the last 90 days, prefers a dashcam-
 *     equipped van among whatever otherwise-qualifying candidates are
 *     left; experienced drivers have no dashcam preference either way.
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
const RECENT_VAN_WINDOW_DAYS = 7;

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

function sizeToken(serviceType: string): string {
  const parts = (serviceType || "").trim().toUpperCase().split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || "";
}

function sizeRank(serviceType: string): number {
  return SIZE_RANK[sizeToken(serviceType)] ?? 3;
}

function isNurseryOrFlexible(wst: string): boolean {
  const t = (wst || "").trim();
  return t === "" || /nursery/i.test(t);
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

  // Eligible route types — same "not turned off" definition the weekly
  // auto-assigner and the routes page itself use, so Close / Pending ECP
  // / AMZ Training rows never get a van pushed onto them.
  const eligibleRouteTypes = await RouteType.find(
    { routeStatus: { $nin: ["off", "Off", "OFF"] }, isActive: { $ne: false } },
    { _id: 1 }
  ).lean() as any[];
  const eligibleTypeIds = eligibleRouteTypes.map((rt: any) => String(rt._id));

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

  // Employee lookup for hiredDate (new-hire dashcam preference).
  const transporterIds = [...new Set(unassigned.map((r) => r.transporterId))];
  const employees = await SymxEmployee.find(
    { transporterId: { $in: transporterIds } },
    { transporterId: 1, hiredDate: 1, firstName: 1, lastName: 1 }
  ).lean() as any[];
  const empByTid = new Map(employees.map((e) => [e.transporterId, e]));

  // Each driver's most recent van at THIS station in the last N days
  // (excluding today), for the "give them the van they know" preference.
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

  // Non-Nursery (exact-size) routes get first crack at size-specific
  // vans; Nursery/flexible routes are processed after, from whatever's
  // left. Senior-first within each group, matching the existing weekly
  // assigner's convention.
  const nonFlexible = unassigned.filter((r) => !isNurseryOrFlexible(r.wst));
  const flexible = unassigned.filter((r) => isNurseryOrFlexible(r.wst));

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

  // ── Exact-size WST routes ──
  for (const route of nonFlexible) {
    const requiredType = (route.wst || "").trim().toLowerCase();

    const recentVanName = recentVanByTid.get(route.transporterId);
    const recentVan = recentVanName ? vehicleByName.get(recentVanName) : null;
    if (
      recentVan &&
      !usedToday.has(recentVan.vehicleName) &&
      (recentVan.serviceType || "").trim().toLowerCase() === requiredType
    ) {
      tryAssign(route, recentVan);
      continue;
    }

    let candidates = vehicles.filter(
      (v) => !usedToday.has(v.vehicleName) && (v.serviceType || "").trim().toLowerCase() === requiredType
    );

    if (candidates.length === 0) {
      result.flaggedCount++;
      result.flagged.push({
        transporterId: route.transporterId,
        employeeName: employeeName(route),
        wst: route.wst || "",
        reason: `No available "${route.wst}" van at this station`,
      });
      continue;
    }

    if (isNewHire(route.transporterId)) {
      const withDashcam = candidates.filter(hasDashcam);
      if (withDashcam.length > 0) candidates = withDashcam;
    }

    tryAssign(route, candidates[0]);
  }

  // ── Nursery / no-WST routes — take what's left, smaller vans first ──
  for (const route of flexible) {
    const recentVanName = recentVanByTid.get(route.transporterId);
    const recentVan = recentVanName ? vehicleByName.get(recentVanName) : null;
    if (recentVan && !usedToday.has(recentVan.vehicleName)) {
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

    if (isNewHire(route.transporterId)) {
      const smallestRank = sizeRank(candidates[0].serviceType);
      const smallestTier = candidates.filter((v) => sizeRank(v.serviceType) === smallestRank);
      const withDashcam = smallestTier.filter(hasDashcam);
      if (withDashcam.length > 0) candidates = withDashcam;
      else candidates = smallestTier;
    }

    tryAssign(route, candidates[0]);
  }

  if (updateOps.length > 0) {
    await SYMXRoute.bulkWrite(updateOps, { ordered: false });
  }

  return result;
}
