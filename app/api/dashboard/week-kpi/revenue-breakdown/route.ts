import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEmployee from "@/lib/models/SymxEmployee";
import SYMXWSTOption from "@/lib/models/SYMXWSTOption";
import RouteType from "@/lib/models/RouteType";

/**
 * GET  /api/dashboard/week-kpi/revenue-breakdown?date=2026-07-06
 *      Returns every SYMXRoute for that calendar day, enriched with employee name,
 *      WST rate, computed revenue, route type name, etc.
 *
 * PATCH /api/dashboard/week-kpi/revenue-breakdown
 *       Body: { routeId, updates: { wst?, totalHours?, wstRevenue? } }
 *       Updates the route document, recomputes wstRevenue if wst or totalHours changed,
 *       and returns the updated record.
 */

// ── Helper: parse duration string to decimal hours ──
function durToHrs(durRaw: any): number {
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
}

// ── Helper: parse paycom time → minutes ──
function parseTime(timeStr: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s?(AM|PM))?$/i);
  if (!match) return null;
  let hrs = parseInt(match[1]);
  const mins = parseInt(match[2]);
  const ampm = match[3] ? match[3].toUpperCase() : null;
  if (ampm === "PM" && hrs < 12) hrs += 12;
  if (ampm === "AM" && hrs === 12) hrs = 0;
  return hrs * 60 + mins;
}

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
    const dateStr = searchParams.get("date") || "";

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: "date parameter is required (YYYY-MM-DD)" }, { status: 400 });
    }

    const dayStart = new Date(dateStr + "T00:00:00.000Z");
    const dayEnd = new Date(dateStr + "T23:59:59.999Z");

    // Fetch reference data + routes in parallel
    const [routes, employees, wstOptions, routeTypes] = await Promise.all([
      SYMXRoute.find(
        { date: { $gte: dayStart, $lte: dayEnd } },
        {
          _id: 1, transporterId: 1, typeId: 1, type: 1,
          wst: 1, wstRevenue: 1, wstDuration: 1,
          totalHours: 1, routeNumber: 1, routeSize: 1,
          stopCount: 1, packageCount: 1,
          paycomInDay: 1, paycomOutLunch: 1, paycomInLunch: 1, paycomOutDay: 1,
        }
      ).lean(),
      SymxEmployee.find(
        { status: "Active" },
        { transporterId: 1, firstName: 1, lastName: 1, rate: 1 }
      ).lean(),
      SYMXWSTOption.find({ isActive: true }).lean(),
      RouteType.find({ isActive: true }, { name: 1, group: 1 }).lean(),
    ]);

    // Build lookup maps
    const empMap = new Map(
      (employees as any[]).map(e => [e.transporterId, e])
    );
    const wstMap = new Map(
      (wstOptions as any[]).map(w => [(w.wst || "").trim().toLowerCase(), w.revenue || 0])
    );
    const rtMap = new Map(
      (routeTypes as any[]).map(rt => [String(rt._id), rt])
    );

    // Enrich routes
    const records = (routes as any[]).map(r => {
      const emp = empMap.get(r.transporterId);
      const employeeName = emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() : r.transporterId || "Unknown";
      const rate = emp ? Number(emp.rate) || 0 : 0;

      // Use wstDuration first, fallback to totalHours decimal duration
      let totalHrsDecimal = r.wstDuration || durToHrs(r.totalHours || "");

      const wstVal = (r.wst || "").trim().toLowerCase();
      const wstRate = wstMap.get(wstVal) || 0;
      const computedRevenue = Math.round(wstRate * totalHrsDecimal * 100) / 100;
      const storedRevenue = r.wstRevenue || 0;

      // Resolve route type name
      const rt = r.typeId ? rtMap.get(String(r.typeId)) : null;
      const routeTypeName = rt ? (rt.name || "") : "";

      return {
        _id: String(r._id),
        transporterId: r.transporterId,
        employeeName,
        rate,
        wst: r.wst || "",
        wstRate,
        wstDuration: r.wstDuration || 0,
        totalHours: r.totalHours || "",
        totalHrsDecimal: Math.round(totalHrsDecimal * 100) / 100,
        routeNumber: r.routeNumber || "",
        routeSize: r.routeSize || "",
        routeTypeName,
        stopCount: r.stopCount || 0,
        packageCount: r.packageCount || 0,
        storedRevenue,
        computedRevenue,
        revenue: storedRevenue > 0 ? storedRevenue : computedRevenue,
      };
    });

    // Sort by revenue descending
    records.sort((a, b) => b.revenue - a.revenue);

    const grandTotal = records.reduce((sum, r) => sum + r.revenue, 0);

    return NextResponse.json({
      date: dateStr,
      records,
      grandTotal: Math.round(grandTotal * 100) / 100,
    });
  } catch (error) {
    console.error("Revenue breakdown API Error:", error);
    return NextResponse.json({ error: "Failed to fetch revenue breakdown" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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

    const body = await req.json();
    const { routeId, updates } = body;

    if (!routeId || !updates) {
      return NextResponse.json({ error: "routeId and updates are required" }, { status: 400 });
    }

    // Build the update payload
    const setPayload: Record<string, any> = {};

    if (updates.wst !== undefined) {
      setPayload.wst = updates.wst;
    }
    if (updates.wstDuration !== undefined) {
      setPayload.wstDuration = Number(updates.wstDuration) || 0;
    }
    if (updates.wstRevenue !== undefined) {
      setPayload.wstRevenue = Number(updates.wstRevenue) || 0;
    }

    // If wst or wstDuration changed, recompute wstRevenue from WST rate
    if (updates.wst !== undefined || updates.wstDuration !== undefined) {
      const route = await SYMXRoute.findById(routeId).lean() as any;
      if (!route) {
        return NextResponse.json({ error: "Route not found" }, { status: 404 });
      }

      const wstOptions = await SYMXWSTOption.find({ isActive: true }).lean();
      const wstMap = new Map(
        (wstOptions as any[]).map(w => [(w.wst || "").trim().toLowerCase(), w.revenue || 0])
      );

      const finalWst = (updates.wst !== undefined ? updates.wst : route.wst || "").trim().toLowerCase();
      const wstRate = wstMap.get(finalWst) || 0;

      const finalWstDuration = updates.wstDuration !== undefined ? Number(updates.wstDuration) : route.wstDuration || durToHrs(route.totalHours || "");

      setPayload.wstRevenue = Math.round(wstRate * finalWstDuration * 100) / 100;
    }

    const updatedRoute = await SYMXRoute.findByIdAndUpdate(
      routeId,
      { $set: setPayload },
      { new: true }
    ).lean();

    if (!updatedRoute) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, route: updatedRoute });
  } catch (error) {
    console.error("Revenue breakdown PATCH Error:", error);
    return NextResponse.json({ error: "Failed to update route" }, { status: 500 });
  }
}
