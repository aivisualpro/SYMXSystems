import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEmployee from "@/lib/models/SymxEmployee";
import { auditDay, computeWeekPay, type DayInput, type WeekPay } from "@/lib/payroll-audit";

// GET /api/hr/timecard-audit?start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns, for every active employee, a day-by-day audit across the given
// date range (intended to be a 14-day pay period) comparing Paycom punches,
// dispatcher-observed attendance, Amazon Flex app data, and vehicle
// inspection time against each other and against CA meal-period law.
export async function GET(req: NextRequest) {
  try {
    await requirePermission("HR", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");
    if (!startStr || !endStr) {
      return NextResponse.json({ error: "start and end are required (YYYY-MM-DD)" }, { status: 400 });
    }

    const start = new Date(`${startStr}T00:00:00.000Z`);
    const end = new Date(`${endStr}T23:59:59.999Z`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid start/end date" }, { status: 400 });
    }

    await connectToDatabase();

    // Routes are fetched first so we know which transporterIds actually have punch
    // data in this pay period — an employee terminated mid-period still needs to be
    // audited (and paid) for the days they worked before their status flipped, so
    // "Active" alone can't be the only way into this list.
    const routes = await SYMXRoute.find(
      { date: { $gte: start, $lte: end } },
      {
        transporterId: 1,
        date: 1,
        weekDay: 1,
        attendance: 1,
        attendanceTime: 1,
        paycomInDay: 1,
        paycomOutLunch: 1,
        paycomInLunch: 1,
        paycomOutDay: 1,
        amazonOutLunch: 1,
        amazonInLunch: 1,
        amazonAppLogout: 1,
        inspectionTime: 1,
      }
    ).lean();

    const transporterIdsWithData = Array.from(new Set((routes as any[]).map((r) => r.transporterId).filter(Boolean)));

    // Include every currently-Active employee (even ones with no data yet this period —
    // they'll just show "No record" cells), PLUS anyone of any status who has at least
    // one route record in this period (covers employees terminated/marked inactive
    // partway through the pay period).
    const employees = await SymxEmployee.find(
      {
        transporterId: { $exists: true, $ne: "" },
        $or: [{ status: "Active" }, { transporterId: { $in: transporterIdsWithData } }],
      },
      { firstName: 1, lastName: 1, transporterId: 1, eeCode: 1, mealWaiverFile: 1, rate: 1, status: 1 }
    ).lean();

    // Group routes by transporterId -> dateKey (YYYY-MM-DD) -> route
    const routesByTransporter = new Map<string, Map<string, any>>();
    for (const r of routes as any[]) {
      const dateKey = new Date(r.date).toISOString().split("T")[0];
      if (!routesByTransporter.has(r.transporterId)) routesByTransporter.set(r.transporterId, new Map());
      routesByTransporter.get(r.transporterId)!.set(dateKey, r);
    }

    // Build the list of dates in range
    const dateKeys: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      dateKeys.push(cursor.toISOString().split("T")[0]);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const todayKey = new Date().toISOString().split("T")[0];

    const results = (employees as any[])
      .map((emp) => {
        const empRoutes = routesByTransporter.get(emp.transporterId) || new Map();
        let totalMealPremiumHours = 0;
        let violationCount = 0;
        let warningCount = 0;

        const days = dateKeys.map((dateKey) => {
          const route = empRoutes.get(dateKey);
          const dayInput: DayInput = {
            date: dateKey,
            attendance: route?.attendance || "",
            attendanceTime: route?.attendanceTime || "",
            paycomInDay: route?.paycomInDay || "",
            paycomOutLunch: route?.paycomOutLunch || "",
            paycomInLunch: route?.paycomInLunch || "",
            paycomOutDay: route?.paycomOutDay || "",
            amazonOutLunch: route?.amazonOutLunch || "",
            amazonInLunch: route?.amazonInLunch || "",
            amazonAppLogout: route?.amazonAppLogout || "",
            inspectionTime: route?.inspectionTime || "",
          };
          const audit = auditDay(
            dayInput,
            { mealWaiverFile: emp.mealWaiverFile },
            { isToday: dateKey === todayKey, isFuture: dateKey > todayKey }
          );
          totalMealPremiumHours += audit.mealPremiumHours;
          violationCount += audit.violations.filter((v) => v.severity === "violation").length;
          warningCount += audit.violations.filter((v) => v.severity === "warning").length;

          return {
            weekDay: route?.weekDay || "",
            hasRecord: !!route,
            ...dayInput,
            violations: audit.violations,
            mealPremiumHours: audit.mealPremiumHours,
          };
        });

        // Split into 7-day weeks (Sun-Sat) for CA overtime, which is strictly a
        // per-workweek calculation and can't be blended across the pay period.
        const rate = typeof emp.rate === "number" ? emp.rate : 0;
        const weeks: WeekPay[] = [];
        for (let i = 0; i < days.length; i += 7) {
          const chunk = days.slice(i, i + 7).map((d) => ({ day: d, mealPremiumHours: d.mealPremiumHours }));
          weeks.push(computeWeekPay(chunk, rate));
        }
        const payPeriodPay = {
          rate,
          weeks,
          totalRegHours: Math.round(weeks.reduce((s, w) => s + w.regHours, 0) * 100) / 100,
          totalOt15Hours: Math.round(weeks.reduce((s, w) => s + w.ot15Hours, 0) * 100) / 100,
          totalOt2Hours: Math.round(weeks.reduce((s, w) => s + w.ot2Hours, 0) * 100) / 100,
          totalGrossPay: Math.round(weeks.reduce((s, w) => s + w.grossPay, 0) * 100) / 100,
        };

        return {
          employeeId: String(emp._id),
          employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
          employeeStatus: emp.status || "Active",
          eeCode: emp.eeCode || "",
          transporterId: emp.transporterId,
          mealWaiverFile: emp.mealWaiverFile || "",
          days,
          totalMealPremiumHours,
          violationCount,
          warningCount,
          payPeriodPay,
        };
      })
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    const summary = {
      employeeCount: results.length,
      totalMealPremiumHours: results.reduce((s, r) => s + r.totalMealPremiumHours, 0),
      totalViolations: results.reduce((s, r) => s + r.violationCount, 0),
      totalWarnings: results.reduce((s, r) => s + r.warningCount, 0),
      employeesWithIssues: results.filter((r) => r.violationCount + r.warningCount > 0).length,
      totalGrossPayroll: Math.round(results.reduce((s, r) => s + r.payPeriodPay.totalGrossPay, 0) * 100) / 100,
      employeesMissingRate: results.filter((r) => !r.payPeriodPay.rate).length,
    };

    return NextResponse.json({ success: true, dateKeys, employees: results, summary });
  } catch (error: any) {
    console.error("[Timecard Audit] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to run timecard audit" }, { status: 500 });
  }
}
