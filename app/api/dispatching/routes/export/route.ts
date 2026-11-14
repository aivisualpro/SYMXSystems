import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { getRequestScope, orgWide } from "@/lib/scoped-query";
import { canViewCompensation } from "@/lib/compensation-visibility";
import Site from "@/lib/models/Site";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEmployee from "@/lib/models/SymxEmployee";
import RouteType from "@/lib/models/RouteType";

/**
 * GET /api/dispatching/routes/export?site=DFO3&from=2026-10-24&to=2026-11-13
 * Downloads every route row for one station and date range as a CSV
 * (opens in Excel / Sheets). Pay columns are only included for people
 * allowed to see compensation.
 */
const csvCell = (v: any) => {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : Array.isArray(v) ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest) {
  let session: any;
  try {
    session = await requirePermission("Dispatching", "view");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.name === "ForbiddenError" ? 403 : 401 });
  }

  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("site") || "").trim().toUpperCase();
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (!code || !ymd.test(from) || !ymd.test(to) || from > to) {
    return NextResponse.json({ error: "Use ?site=DFO3&from=YYYY-MM-DD&to=YYYY-MM-DD" }, { status: 400 });
  }

  await connectToDatabase();
  const site: any = await Site.findOne({ code }).lean();
  if (!site) return NextResponse.json({ error: "Station not found" }, { status: 404 });
  const scope = await getRequestScope();
  if (!scope.allowedSiteIds.includes(String(site._id))) {
    return NextResponse.json({ error: "You don't have access to that station" }, { status: 403 });
  }

  const rows: any[] = await orgWide(
    SYMXRoute.find({
      siteId: new mongoose.Types.ObjectId(String(site._id)),
      date: { $gte: new Date(from + "T00:00:00.000Z"), $lte: new Date(to + "T23:59:59.999Z") },
    }).sort({ date: 1, routeNumber: 1 }),
    "export of one station's routes; access to that station was verified against the user's allowed stations above"
  ).lean();

  const tids = [...new Set(rows.map((r) => r.transporterId).filter(Boolean))];
  const [emps, types] = await Promise.all([
    orgWide(
      SymxEmployee.find({ transporterId: { $in: tids } }, { transporterId: 1, firstName: 1, lastName: 1 }),
      "driver names for routes already scoped to the requested station"
    ).lean() as Promise<any[]>,
    RouteType.find({}, { name: 1 }).lean() as Promise<any[]>,
  ]);
  const nameByTid = new Map(emps.map((e) => [e.transporterId, `${e.firstName || ""} ${e.lastName || ""}`.trim()]));
  const typeById = new Map(types.map((t) => [String(t._id), t.name]));

  const canComp = await canViewCompensation(session);
  const cols: [string, (r: any) => any][] = [
    ["Date", (r) => r.date],
    ["Weekday", (r) => r.weekDay],
    ["Station", () => code],
    ["Driver", (r) => nameByTid.get(r.transporterId) || ""],
    ["Transporter ID", (r) => r.transporterId],
    ["Type", (r) => typeById.get(String(r.typeId || "")) || ""],
    ["Route #", (r) => r.routeNumber],
    ["Service Type", (r) => r.wst],
    ["Amazon Service Type", (r) => r.amazonServiceType],
    ["Van", (r) => r.van],
    ["Route Size", (r) => r.routeSize],
    ["Dashcam", (r) => r.dashcam],
    ["Wave Time", (r) => r.waveTime],
    ["Pad", (r) => r.pad],
    ["Staging", (r) => r.stagingLocation],
    ["Stops", (r) => r.stopCount],
    ["Packages", (r) => r.packageCount],
    ["Extra Stops", (r) => r.extraStops],
    ["Stops Rescued", (r) => r.stopsRescued],
    ["Route Duration", (r) => r.routeDuration],
    ["Stops / Hr", (r) => r.stopsPerHour],
    ["On-road Pickups", (r) => r.onRoadPickups],
    ["Pickups Done", (r) => r.onRoadPickupsDone],
    ["App Sign-in", (r) => r.appSignIn],
    ["Actual Departure", (r) => r.actualDepartureTime],
    ["Departure Delay", (r) => r.departureDelay],
    ["Planned First Stop", (r) => r.plannedFirstStop],
    ["Actual First Stop", (r) => r.actualFirstStop],
    ["Planned Last Stop", (r) => r.plannedLastStop],
    ["Actual Last Stop", (r) => r.actualLastStop],
    ["Planned RTS", (r) => r.plannedRTSTime],
    ["Actual Return", (r) => r.actualReturnTime],
    ["App Logout", (r) => r.amazonAppLogout],
    ["Delivery Completion Time", (r) => r.deliveryCompletionTime],
    ["Efficiency %", (r) => r.driverEfficiency],
    ["Attendance", (r) => r.attendance],
    ["Total Hours", (r) => r.totalHours],
    ...(canComp
      ? ([["Reg Pay", (r: any) => r.regPay], ["OT Pay", (r: any) => r.otPay], ["Total Cost", (r: any) => r.totalCost]] as [string, (r: any) => any][])
      : []),
    ["Notes", (r) => r.notes],
  ];

  const lines = [cols.map(([h]) => csvCell(h)).join(",")];
  for (const r of rows) lines.push(cols.map(([, f]) => csvCell(f(r))).join(","));

  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${code}-routes-${from}-to-${to}.csv"`,
    },
  });
}
