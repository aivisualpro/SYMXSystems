import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxEmployee from "@/lib/models/SymxEmployee";
import RouteType from "@/lib/models/RouteType";
import SYMXWSTOption from "@/lib/models/SYMXWSTOption";

/**
 * GET /api/dashboard/mom-kpi?months=12
 *
 * Computes Month-over-Month KPI data using MongoDB aggregation pipelines.
 * All 9 KPI metrics are computed per calendar month:
 *   Revenue, Driver %, Operations %, Labor Theory %, Labor Actual %,
 *   Labor Cost Theory, Labor Cost Actual, Labor Var $, Labor Var %
 *
 * Uses $facet to run revenue + actual-cost pipelines in a single round-trip,
 * and a parallel Promise.all for the schedule-side theory computation.
 */
export async function GET(req: NextRequest) {
  try {
    await requirePermission("Dashboard", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const session = await getSession();
    if (!session || !session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const months = Math.min(Math.max(parseInt(searchParams.get("months") || "12", 10), 1), 36);

    // Calculate cutoff date
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    cutoff.setDate(1);
    cutoff.setHours(0, 0, 0, 0);

    // ── 1. Fetch reference data in parallel ──
    const [routeTypes, wstOptions, activeEmployees] = await Promise.all([
      RouteType.find({ isActive: true }, { name: 1, theoryHrs: 1, group: 1 }).lean(),
      SYMXWSTOption.find({ isActive: true }).lean(),
      SymxEmployee.find(
        { status: "Active" },
        { transporterId: 1, rate: 1, firstName: 1, lastName: 1 }
      ).lean(),
    ]);

    // Build lookup maps
    const routeTypeByIdMap = new Map((routeTypes as any[]).map(rt => [String(rt._id), rt]));
    const routeTypeByNameMap = new Map((routeTypes as any[]).map(rt => [(rt.name || "").trim().toLowerCase(), rt]));
    const wstMap = new Map((wstOptions as any[]).map(w => [(w.wst || "").trim().toLowerCase(), w.revenue || 0]));
    const employeeRateMap = new Map((activeEmployees as any[]).map(e => [e.transporterId, Number(e.rate) || 0]));

    // ── 2. Faceted aggregation on SYMXRoutes ──
    // Single round-trip: revenue + actual cost + group breakdown per month
    const routesPipeline = [
      {
        $match: {
          date: { $gte: cutoff },
        },
      },
      {
        $facet: {
          // Revenue per month (using wstRevenue field)
          revenueByMonth: [
            {
              $match: { wstRevenue: { $gt: 0 } },
            },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
                revenue: { $sum: { $ifNull: ["$wstRevenue", 0] } },
              },
            },
          ],
          // Actual cost per month with group breakdown
          actualByMonth: [
            {
              $project: {
                month: { $dateToString: { format: "%Y-%m", date: "$date" } },
                transporterId: 1,
                typeId: 1,
                type: 1,
                totalCost: { $ifNull: ["$totalCost", 0] },
                paycomInDay: 1,
                paycomOutLunch: 1,
                paycomInLunch: 1,
                paycomOutDay: 1,
                totalHours: 1,
                wst: 1,
                wstRevenue: { $ifNull: ["$wstRevenue", 0] },
              },
            },
            {
              $group: {
                _id: "$month",
                records: { $push: "$$ROOT" },
              },
            },
          ],
        },
      },
    ];

    // ── 3. Schedule-side theory cost pipeline ──
    const schedulePipeline = [
      {
        $match: {
          date: { $gte: cutoff },
          typeId: { $exists: true, $ne: null },
        },
      },
      {
        $project: {
          month: { $dateToString: { format: "%Y-%m", date: "$date" } },
          transporterId: 1,
          typeId: 1,
          status: 1,
        },
      },
      {
        $group: {
          _id: "$month",
          records: { $push: "$$ROOT" },
        },
      },
    ];

    // Run both pipelines in parallel
    const [routesResult, scheduleResult] = await Promise.all([
      SYMXRoute.aggregate(routesPipeline).allowDiskUse(true),
      SymxEmployeeSchedule.aggregate(schedulePipeline).allowDiskUse(true),
    ]);

    // ── 4. Process results ──
    const faceted = routesResult[0] || { revenueByMonth: [], actualByMonth: [] };

    // Revenue map: month → total revenue
    const revenueMap = new Map<string, number>();
    for (const r of faceted.revenueByMonth) {
      revenueMap.set(r._id, Math.round(r.revenue * 100) / 100);
    }

    // Parse time helper
    const parseTime = (timeStr: string): number | null => {
      if (!timeStr) return null;
      const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s?(AM|PM))?$/i);
      if (!match) return null;
      let hrs = parseInt(match[1]);
      const mins = parseInt(match[2]);
      const ampm = match[3] ? match[3].toUpperCase() : null;
      if (ampm === "PM" && hrs < 12) hrs += 12;
      if (ampm === "AM" && hrs === 12) hrs = 0;
      return hrs * 60 + mins;
    };

    const durToHrs = (durRaw: any): number => {
      if (!durRaw) return 0;
      const durStr = String(durRaw).trim();
      const timeMatch = durStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
      if (timeMatch) {
        return parseInt(timeMatch[1], 10) + parseInt(timeMatch[2], 10) / 60;
      }
      const floatMatch = durStr.match(/^(\d+(?:\.\d+)?)/);
      if (floatMatch) {
        const num = Number(floatMatch[1]);
        if (!isNaN(num)) return num;
      }
      return 0;
    };

    // Actual cost map: month → { totalActual, driverActual, opsActual, computedRevenue }
    const actualMap = new Map<string, { totalActual: number; driverActual: number; opsActual: number; computedRevenue: number }>();
    for (const group of faceted.actualByMonth) {
      const month = group._id;
      let totalActual = 0;
      let driverActual = 0;
      let opsActual = 0;
      let computedRevenue = 0;

      for (const r of group.records) {
        // Compute actual hours from paycom times
        const inDayM = parseTime(r.paycomInDay || "");
        const outLunchM = parseTime(r.paycomOutLunch || "");
        const inLunchM = parseTime(r.paycomInLunch || "");
        const outDayM = parseTime(r.paycomOutDay || "");

        let dynamicTotalMs = 0;
        if (inDayM !== null && outDayM !== null) {
          if (outLunchM !== null && inLunchM !== null) {
            dynamicTotalMs = Math.max(0, (outDayM - inLunchM) + (outLunchM - inDayM));
          } else {
            dynamicTotalMs = Math.max(0, outDayM - inDayM);
          }
        }

        let totalHrsDecimal = durToHrs(r.totalHours || "");
        if (dynamicTotalMs > 0) {
          totalHrsDecimal = dynamicTotalMs / 60;
        }

        const regHrs = totalHrsDecimal > 0 ? Math.min(totalHrsDecimal, 8) : 0;
        const otHrs = totalHrsDecimal > 8 ? totalHrsDecimal - 8 : 0;

        const rate = employeeRateMap.get(r.transporterId) || 0;
        const regPay = rate * regHrs;
        const otPay = rate * 1.5 * otHrs;
        const actualCost = Math.round((regPay + otPay) * 100) / 100;

        if (actualCost > 0) {
          totalActual += actualCost;

          // Resolve group via typeId
          const resolvedRT = r.typeId ? routeTypeByIdMap.get(String(r.typeId)) : null;
          const groupName = resolvedRT
            ? (resolvedRT.group || "").trim().toLowerCase()
            : (() => {
                const nameRT = routeTypeByNameMap.get((r.type || "").trim().toLowerCase());
                return nameRT ? (nameRT.group || "").trim().toLowerCase() : "";
              })();

          if (groupName === "driver" || groupName === "drivers") {
            driverActual += actualCost;
          } else if (["operations", "operation", "ops"].includes(groupName)) {
            opsActual += actualCost;
          }
        }

        // WST-based revenue computation
        const wstVal = (r.wst || "").trim().toLowerCase();
        const wstHourlyRate = wstMap.get(wstVal) || 0;
        const wstRevenue = Math.round(wstHourlyRate * totalHrsDecimal * 100) / 100;
        if (wstRevenue > 0) computedRevenue += wstRevenue;
      }

      actualMap.set(month, {
        totalActual: Math.round(totalActual * 100) / 100,
        driverActual: Math.round(driverActual * 100) / 100,
        opsActual: Math.round(opsActual * 100) / 100,
        computedRevenue: Math.round(computedRevenue * 100) / 100,
      });
    }

    // Theory cost map: month → totalTheory
    const theoryMap = new Map<string, number>();
    for (const group of scheduleResult) {
      const month = group._id;
      let totalTheory = 0;

      for (const s of group.records) {
        const statusStr = (s.status || "").trim().toLowerCase();
        if (statusStr === "off") continue;

        const resolvedRT = s.typeId ? routeTypeByIdMap.get(String(s.typeId)) : null;
        const theoryHrs = resolvedRT ? (resolvedRT.theoryHrs || 0) : 0;

        if (theoryHrs > 0) {
          const rate = employeeRateMap.get(s.transporterId) || 0;
          if (rate > 0) {
            const regHrs = Math.min(theoryHrs, 8);
            const otHrs = Math.max(0, theoryHrs - 8);
            const cost = Math.round((regHrs * rate + otHrs * rate * 1.5) * 100) / 100;
            totalTheory += cost;
          }
        }
      }

      theoryMap.set(month, Math.round(totalTheory * 100) / 100);
    }

    // ── 5. Assemble monthly KPI records ──
    // Generate month labels for the requested range
    const monthLabels: string[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthLabels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const monthlyData = monthLabels.map(month => {
      // Use computedRevenue from WST×hrs as primary, fall back to wstRevenue field
      const actual = actualMap.get(month);
      const revenue = actual?.computedRevenue || revenueMap.get(month) || 0;
      const laborCostActual = actual?.totalActual || 0;
      const driverActual = actual?.driverActual || 0;
      const opsActual = actual?.opsActual || 0;
      const laborCostTheory = theoryMap.get(month) || 0;

      const driverPct = laborCostActual > 0 ? Math.round((driverActual / laborCostActual) * 100) : 0;
      const opsPct = laborCostActual > 0 ? Math.round((opsActual / laborCostActual) * 100) : 0;
      const laborTheoryPct = revenue > 0 ? Math.round((laborCostTheory / revenue) * 100) : 0;
      const laborActualPct = revenue > 0 ? Math.round((laborCostActual / revenue) * 100) : 0;
      const laborVarDol = Math.round((laborCostTheory - laborCostActual) * 100) / 100;
      const laborVarPct = laborCostTheory > 0 ? Math.round((laborVarDol / laborCostTheory) * 100) : 0;

      return {
        month,
        revenue: Math.round(revenue * 100) / 100,
        driverPct,
        opsPct,
        laborTheoryPct,
        laborActualPct,
        laborCostTheory,
        laborCostActual,
        laborVarDol,
        laborVarPct,
      };
    });

    // ── 6. Compute totals ──
    const totals = monthlyData.reduce(
      (acc, m) => ({
        totalRevenue: acc.totalRevenue + m.revenue,
        totalLaborTheory: acc.totalLaborTheory + m.laborCostTheory,
        totalLaborActual: acc.totalLaborActual + m.laborCostActual,
        totalLaborVarDol: acc.totalLaborVarDol + m.laborVarDol,
      }),
      { totalRevenue: 0, totalLaborTheory: 0, totalLaborActual: 0, totalLaborVarDol: 0 }
    );

    return NextResponse.json({
      months: monthlyData,
      totals: {
        ...totals,
        totalRevenue: Math.round(totals.totalRevenue * 100) / 100,
        totalLaborTheory: Math.round(totals.totalLaborTheory * 100) / 100,
        totalLaborActual: Math.round(totals.totalLaborActual * 100) / 100,
        totalLaborVarDol: Math.round(totals.totalLaborVarDol * 100) / 100,
        avgLaborVarPct:
          totals.totalLaborTheory > 0
            ? Math.round(((totals.totalLaborVarDol / totals.totalLaborTheory) * 100) * 100) / 100
            : 0,
      },
    });
  } catch (error) {
    console.error("MoM KPI API Error:", error);
    return NextResponse.json({ error: "Failed to fetch MoM KPI data" }, { status: 500 });
  }
}
