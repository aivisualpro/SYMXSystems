import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/db";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEmployee from "@/lib/models/SymxEmployee";
import RouteType from "@/lib/models/RouteType";
import ScheduleAuditLog from "@/lib/models/ScheduleAuditLog";

// GET /api/hr/callouts?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns every SYMXRoute record whose resolved route type is "Call Out"
// (i.e. an employee was scheduled and proactively called in instead of
// showing up), within the given (inclusive) date range, enriched with
// employee info + what shift they were originally scheduled for before
// it was changed to "Call Out" (pulled from ScheduleAuditLog). Aggregation
// (per-employee counts, weekday breakdown, etc.) is computed client-side.
export async function GET(req: NextRequest) {
  try {
    await requirePermission("HR", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!from || !to) {
      return NextResponse.json({ error: "from and to date params are required" }, { status: 400 });
    }

    await connectToDatabase();

    // Resolve all RouteTypes once — needed both to find "Call Out" and to
    // resolve whatever type a route was previously scheduled as.
    const allRouteTypes = await RouteType.find({}, { _id: 1, name: 1 }).lean() as any[];
    const rtIdToName = new Map<string, string>();
    allRouteTypes.forEach((rt) => rtIdToName.set(String(rt._id), rt.name || ""));

    const callOutType = allRouteTypes.find((rt) => (rt.name || "").trim().toLowerCase() === "call out");
    if (!callOutType) {
      return NextResponse.json({ rows: [] });
    }

    const typeIdStr = String(callOutType._id);
    const typeIdVariants: any[] = [typeIdStr];
    try {
      typeIdVariants.push(new mongoose.Types.ObjectId(typeIdStr));
    } catch { /* ignore */ }

    // Inclusive date range — "to" is extended to end-of-day
    const startDate = new Date(`${from}T00:00:00.000Z`);
    const endDate = new Date(`${to}T23:59:59.999Z`);

    const routes = await SYMXRoute.find(
      {
        date: { $gte: startDate, $lte: endDate },
        typeId: { $in: typeIdVariants },
      },
      { transporterId: 1, date: 1, weekDay: 1, notes: 1 }
    ).sort({ date: -1 }).lean();

    if (routes.length === 0) {
      return NextResponse.json({ rows: [] });
    }

    const transporterIds = [...new Set(routes.map((r: any) => (r.transporterId || "").trim().toUpperCase()))];

    const [employees, auditEntries] = await Promise.all([
      SymxEmployee.find(
        { transporterId: { $in: transporterIds } },
        { transporterId: 1, firstName: 1, lastName: 1, email: 1, phoneNumber: 1, hiredDate: 1, status: 1 }
      ).lean(),
      // Every time a schedule's typeId was changed TO "Call Out" — oldValue tells us
      // what shift the employee was originally scheduled for.
      ScheduleAuditLog.find(
        {
          transporterId: { $in: transporterIds },
          date: { $gte: startDate, $lte: endDate },
          action: "type_changed",
          field: "typeId",
          newValue: typeIdStr,
        },
        { transporterId: 1, date: 1, oldValue: 1, createdAt: 1 }
      ).sort({ createdAt: -1 }).lean(),
    ]);

    const employeeMap: Record<string, any> = {};
    employees.forEach((emp: any) => {
      const tid = (emp.transporterId || "").trim().toUpperCase();
      employeeMap[tid] = {
        id: String(emp._id),
        name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
        email: emp.email || "",
        phoneNumber: emp.phoneNumber || "",
        hiredDate: emp.hiredDate ? new Date(emp.hiredDate).toISOString().split("T")[0] : "",
        status: emp.status || "",
      };
    });

    // Keyed by transporterId_YYYY-MM-DD → the most recent oldValue (typeId) for
    // that change-to-Call-Out event. Sorted desc above, so first-seen wins per key.
    const originalTypeMap: Record<string, string> = {};
    (auditEntries as any[]).forEach((entry) => {
      const tid = (entry.transporterId || "").trim().toUpperCase();
      const dateStr = entry.date ? new Date(entry.date).toISOString().split("T")[0] : "";
      const key = `${tid}_${dateStr}`;
      if (!(key in originalTypeMap)) {
        originalTypeMap[key] = entry.oldValue || "";
      }
    });

    const rows = routes.map((r: any) => {
      const tid = (r.transporterId || "").trim().toUpperCase();
      const emp = employeeMap[tid] || {};
      const dateStr = r.date ? new Date(r.date).toISOString().split("T")[0] : "";
      const originalTypeId = originalTypeMap[`${tid}_${dateStr}`];
      const originalShiftType = originalTypeId ? (rtIdToName.get(originalTypeId) || "") : "";
      return {
        date: dateStr,
        weekDay: r.weekDay || "",
        transporterId: tid,
        employeeId: emp.id || "",
        employeeName: emp.name || tid,
        email: emp.email || "",
        phoneNumber: emp.phoneNumber || "",
        hiredDate: emp.hiredDate || "",
        employeeStatus: emp.status || "",
        originalShiftType: originalShiftType || "Unknown",
        notes: r.notes || "",
      };
    });

    return NextResponse.json({ rows });
  } catch (error: any) {
    console.error("Error fetching callouts:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch callouts" }, { status: 500 });
  }
}
