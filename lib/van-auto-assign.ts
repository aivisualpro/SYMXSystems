/**
 * Van auto-assignment for ONE station and ONE day, solved as a global
 * assignment problem (min-cost bipartite matching / Hungarian algorithm)
 * instead of a driver-by-driver greedy loop. A greedy loop lets an early
 * pick steal the van a later driver needed and silently skips people; the
 * matching minimizes TOTAL penalty across every route at once.
 *
 * Rows that get a van: "Route" and "Training OTR" only (Flight Risk, Trainer,
 * Open, Close, Rescue, Call Out, ... get none). Rows that already have a van
 * are fixed — never moved — and their vans leave the pool.
 *
 * HARD constraints (infinite cost)
 *   - van is Active and belongs to this station; not used by another route today
 *   - Training OTR requires a dashcam (Netradyne) van
 * Every route ends up assigned or flagged with a reason — never silently skipped.
 *
 * SOFT preferences (summed into a cost; lower is better)
 *   - Familiarity: Primary < Backup 1 < Backup 2 < recent van < ever-driven < unknown
 *   - Dashcam: weighted by INEXPERIENCE — drivers ranked by routes completed
 *     (fewest = highest need); a dashcam-less van costs more the newer the driver is
 *   - Size: WST size (L/XL/S…) is the target; bigger or smaller van is allowed but
 *     penalised per step. When bag counts exist, routes are ranked by bags and the
 *     size "ladder" is applied: highest bags -> biggest vans, down the ladder.
 *   - Scarcity: dashcam vans carry a small cost for experienced drivers so they stay
 *     free for the drivers who need them
 */
import mongoose from "mongoose";
import SYMXRoute from "./models/SYMXRoute";
import SymxEmployee from "./models/SymxEmployee";
import Vehicle from "./models/Vehicle";
import RouteType from "./models/RouteType";
import { toPacificDate } from "@/app/(protected)/dispatching/routes/_components/routes-utils";

const RECENT_VAN_WINDOW_DAYS = 45;

// ── Cost weights (tuning knobs) ────────────────────────────────────────
const W = {
  famPrimary: 0, famBackup1: 10, famBackup2: 20,
  famRecentBase: 15, famRecentPerRank: 5,   // most recently used = cheapest
  famSeen: 40, famUnknown: 60,
  dashcamMax: 100,          // dashcam-less van for the most inexperienced driver
  dashcamHoard: 6,          // experienced driver taking a dashcam van
  sizeStep: 20, sizeSmallerExtra: 5,        // per size step off target (smaller slightly worse)
  sizeStepFlexible: 4,      // Training OTR / Nursery rows: soft preference for smaller vans
  unassigned: 1000,         // "leave blank + flag" — must beat any real cost
  hard: 1e7,
};

// Only these need a van at all.
const VAN_ELIGIBLE_TYPE_NAMES = new Set(["route", "training otr"]);

/** Size rank from a WST ("SP L"), Cortex name ("Standard Parcel - Large Van") or van serviceType. */
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
const sizeRank = (t: string) => parseSize(t) ?? 3;

function hasDashcam(v: { dashcam?: string }): boolean {
  const d = (v.dashcam || "").trim().toLowerCase();
  return !!d && d !== "none";
}
const key = (s: any) => String(s || "").trim().toLowerCase();

/** Hungarian algorithm — min-cost assignment of n rows to m >= n columns. Returns col index per row. */
function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  const m = cost[0]?.length ?? 0;
  const u = new Array(n + 1).fill(0), v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0), way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(Infinity);
    const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const res = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) res[p[j] - 1] = j - 1;
  return res;
}

export interface AutoAssignResult {
  assignedCount: number;
  flaggedCount: number;
  assignments: { transporterId: string; employeeName: string; van: string; wst: string; reason: string }[];
  flagged: { transporterId: string; employeeName: string; wst: string; reason: string }[];
}

export async function autoAssignVansForDay(siteId: string, dateStr: string): Promise<AutoAssignResult> {
  const siteObjectId = new mongoose.Types.ObjectId(siteId);

  const rangeStart = new Date(`${dateStr}T00:00:00.000Z`);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 1);
  const rangeEnd = new Date(`${dateStr}T23:59:59.999Z`);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

  const allRouteTypes = await RouteType.find({}, { _id: 1, name: 1 }).lean() as any[];
  const typeIdToName = new Map(allRouteTypes.map((rt: any) => [String(rt._id), (rt.name || "").trim().toLowerCase()]));
  const eligibleTypeIds = allRouteTypes
    .filter((rt: any) => VAN_ELIGIBLE_TYPE_NAMES.has((rt.name || "").trim().toLowerCase()))
    .map((rt: any) => String(rt._id));

  const dayRoutesRaw = await SYMXRoute.find({
    siteId: siteObjectId,
    date: { $gte: rangeStart, $lte: rangeEnd },
  }).lean() as any[];
  const dayRoutes = dayRoutesRaw.filter((r) => toPacificDate(r.date) === dateStr);

  const todo = dayRoutes.filter(
    (r) => (!r.van || !r.van.trim()) && eligibleTypeIds.includes(String(r.typeId || ""))
  );

  const result: AutoAssignResult = { assignedCount: 0, flaggedCount: 0, assignments: [], flagged: [] };
  if (todo.length === 0) return result;

  // Vans already running today (any row) are fixed.
  const usedToday = new Set(dayRoutes.filter((r) => r.van && r.van.trim()).map((r) => key(r.van)));

  const allVehicles = await Vehicle.find(
    { status: "Active", currentSiteId: siteObjectId },
    { vehicleName: 1, serviceType: 1, dashcam: 1 }
  ).lean() as any[];
  const vans = allVehicles.filter((v) => !usedToday.has(key(v.vehicleName)));

  // ── Driver features ──
  const tids = [...new Set(todo.map((r) => r.transporterId))];
  const employees = await SymxEmployee.find(
    { transporterId: { $in: tids } },
    { transporterId: 1, firstName: 1, lastName: 1, defaultVan1: 1, defaultVan2: 1, defaultVan3: 1 }
  ).lean() as any[];
  const empByTid = new Map(employees.map((e) => [e.transporterId, e]));

  // Routes completed (experience): past Route/Training OTR rows with stops, this station.
  const expAgg = await SYMXRoute.aggregate([
    { $match: { siteId: siteObjectId, transporterId: { $in: tids }, date: { $lt: rangeStart }, typeId: { $in: eligibleTypeIds }, stopCount: { $gt: 0 } } },
    { $group: { _id: "$transporterId", n: { $sum: 1 } } },
  ]);
  const completed = new Map<string, number>(expAgg.map((x: any) => [x._id, x.n]));
  const expOf = (tid: string) => completed.get(tid) || 0;
  // Inexperience in [0,1]: 1 = fewest routes completed among today's drivers.
  const sortedExp = [...new Set(tids.map(expOf))].sort((a, b) => a - b);
  const inexperience = (tid: string) =>
    sortedExp.length <= 1 ? 0.5 : 1 - sortedExp.indexOf(expOf(tid)) / (sortedExp.length - 1);

  // Recent vans (most recent first, distinct) + every van ever used in the window.
  const recentStart = new Date(rangeStart);
  recentStart.setUTCDate(recentStart.getUTCDate() - RECENT_VAN_WINDOW_DAYS);
  const recentRaw = await SYMXRoute.find({
    siteId: siteObjectId, transporterId: { $in: tids }, van: { $nin: ["", null] },
    date: { $gte: recentStart, $lt: rangeStart },
  }, { transporterId: 1, van: 1, date: 1 }).sort({ date: -1 }).lean() as any[];
  const recentVans = new Map<string, string[]>();
  for (const r of recentRaw) {
    const list = recentVans.get(r.transporterId) || [];
    if (!list.includes(key(r.van))) list.push(key(r.van));
    recentVans.set(r.transporterId, list);
  }

  const nameOf = (r: any): string => {
    const e = empByTid.get(r.transporterId);
    return r.employeeName || (e ? `${e.firstName || ""} ${e.lastName || ""}`.trim() : r.transporterId);
  };

  // ── Route features ──
  const isTrainingOTR = (r: any) => typeIdToName.get(String(r.typeId || "")) === "training otr";
  const wstSize = (r: any) => parseSize(r.wst) ?? parseSize(r.amazonServiceType || "");
  const isFlexible = (r: any) => isTrainingOTR(r) || wstSize(r) === null || /nursery/i.test(r.wst || "");
  const bagsOf = (r: any) => { const n = parseFloat(String(r.bags ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) ? n : 0; };

  // Bag ladder: when most size-bearing routes have bags, rank by bags and give the
  // biggest vans to the highest-bag routes, stepping down.
  const sized = todo.filter((r) => !isFlexible(r));
  const withBags = sized.filter((r) => bagsOf(r) > 0);
  const targetByRoute = new Map<any, number>();
  const ladderNote = new Map<any, string>();
  if (withBags.length >= Math.max(2, Math.ceil(sized.length * 0.5))) {
    const poolSizes = vans.map((v) => sizeRank(v.serviceType)).sort((a, b) => b - a);
    const ranked = [...withBags].sort((a, b) => bagsOf(b) - bagsOf(a));
    ranked.forEach((r, i) => {
      if (poolSizes.length === 0) return;
      const idx = Math.min(poolSizes.length - 1, Math.floor((i * poolSizes.length) / ranked.length));
      targetByRoute.set(r, poolSizes[idx]);
      ladderNote.set(r, `bags #${i + 1}/${ranked.length}`);
    });
  }
  const targetSize = (r: any): number =>
    targetByRoute.get(r) ?? (isFlexible(r) ? 1 : (wstSize(r) ?? 3));

  // ── Cost matrix ──
  const famCost = (tid: string, van: any): { cost: number; tag: string } => {
    const e = empByTid.get(tid);
    const k = key(van.vehicleName);
    if (e && key(e.defaultVan1) === k) return { cost: W.famPrimary, tag: "primary van" };
    if (e && key(e.defaultVan2) === k) return { cost: W.famBackup1, tag: "backup 1" };
    if (e && key(e.defaultVan3) === k) return { cost: W.famBackup2, tag: "backup 2" };
    const rec = recentVans.get(tid) || [];
    const ri = rec.indexOf(k);
    if (ri >= 0) return { cost: W.famRecentBase + ri * W.famRecentPerRank, tag: ri === 0 ? "most recent van" : "drove it recently" };
    return { cost: rec.length ? W.famSeen : W.famUnknown, tag: "" };
  };

  const edge = (r: any, van: any): { cost: number; why: string[] } => {
    const why: string[] = [];
    const training = isTrainingOTR(r);
    const dash = hasDashcam(van);
    if (training && !dash) return { cost: W.hard, why: ["no dashcam"] };

    const fam = famCost(r.transporterId, van);
    if (fam.tag) why.push(fam.tag);

    const inexp = inexperience(r.transporterId);
    let dashCost = 0;
    if (!dash) dashCost = W.dashcamMax * inexp;
    else {
      why.push(`dashcam, ${expOf(r.transporterId)} routes done`);
      if (inexp < 0.5) dashCost = W.dashcamHoard;
    }

    const tgt = targetSize(r);
    const d = sizeRank(van.serviceType) - tgt;
    const step = isFlexible(r) && !targetByRoute.has(r) ? W.sizeStepFlexible : W.sizeStep;
    const sizeCost = Math.abs(d) * step + (d < 0 ? W.sizeSmallerExtra * Math.abs(d) : 0);
    if (!isFlexible(r) || targetByRoute.has(r)) {
      const lab = (n: number) => (["", "S", "M", "L", "XL", "XXL"][n] || String(n));
      why.push(d === 0 ? `size ${lab(tgt)} match` : `size ${lab(sizeRank(van.serviceType))} for ${lab(tgt)}`);
      const ln = ladderNote.get(r);
      if (ln) why.push(ln);
    }
    return { cost: fam.cost + dashCost + sizeCost, why };
  };

  // Rows = routes, columns = vans + one "leave blank" column per route.
  const n = todo.length, m = vans.length;
  const edges: { cost: number; why: string[] }[][] = todo.map((r) => vans.map((v) => edge(r, v)));
  const matrix: number[][] = todo.map((_, i) => {
    const row: number[] = [];
    for (let j = 0; j < m; j++) row.push(edges[i][j].cost);
    for (let j = 0; j < n; j++) row.push(W.unassigned);
    return row;
  });
  const pick = hungarian(matrix);

  const updateOps: any[] = [];
  todo.forEach((r, i) => {
    const j = pick[i];
    if (j >= 0 && j < m && edges[i][j].cost < W.hard) {
      const van = vans[j];
      updateOps.push({
        updateOne: {
          filter: { _id: r._id },
          update: { $set: { van: van.vehicleName, serviceType: van.serviceType || "", dashcam: van.dashcam || "" } },
        },
      });
      result.assignedCount++;
      result.assignments.push({
        transporterId: r.transporterId, employeeName: nameOf(r), van: van.vehicleName,
        wst: r.wst || "", reason: edges[i][j].why.join(" · "),
      });
    } else {
      const training = isTrainingOTR(r);
      const dashLeft = vans.some(hasDashcam);
      result.flaggedCount++;
      result.flagged.push({
        transporterId: r.transporterId, employeeName: nameOf(r), wst: r.wst || "",
        reason: m === 0
          ? "No active unassigned van at this station"
          : training && !dashLeft
            ? "Training OTR needs a dashcam van and none are left"
            : training
              ? "Training OTR needs a dashcam van — remaining ones went to other Training OTR routes"
              : "Not enough vans for every route today",
      });
    }
  });

  if (updateOps.length > 0) await SYMXRoute.bulkWrite(updateOps, { ordered: false });
  return result;
}
