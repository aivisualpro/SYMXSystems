import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import RouteType from "@/lib/models/RouteType";
import { requireSuperAdminApi } from "@/lib/payments-auth";

/**
 * POST — adds the "Flight Risk" shift type (Super Admin only, safe to repeat).
 *
 * Flight Risk means "we're planning for this person to possibly not show up
 * tomorrow". It copies everything from "Route" (status, DA/Ops flags, group,
 * start times at every station, where it appears) and differs only in name,
 * colour and icon so it stands out on the schedule.
 */
export async function POST() {
  const auth = await requireSuperAdminApi();
  if ("response" in auth) return auth.response;

  await connectToDatabase();

  const existing: any = await RouteType.findOne({ name: { $regex: "^flight risk$", $options: "i" } }).lean();
  if (existing) return NextResponse.json({ created: false, message: "Flight Risk already exists." });

  const route: any = await RouteType.findOne({ name: { $regex: "^route$", $options: "i" } }).lean();
  if (!route) {
    return NextResponse.json({ error: 'No "Route" shift type found to copy from.' }, { status: 400 });
  }

  const last: any = await RouteType.findOne({}).sort({ sortOrder: -1 }).select("sortOrder").lean();

  const created = await RouteType.create({
    name: "Flight Risk",
    color: "#DC2626",
    icon: "Flag",
    startTime: route.startTime || "",
    theoryHrs: route.theoryHrs || 0,
    stations: Array.isArray(route.stations) ? route.stations.map((s: any) => ({ ...s })) : [],
    group: route.group || "None",
    routeStatus: route.routeStatus || "Scheduled",
    isDefault: false, // Route stays the default for new schedules
    partOf: Array.isArray(route.partOf) ? [...route.partOf] : [],
    isDA: !!route.isDA,
    isOps: !!route.isOps,
    isStandby: !!route.isStandby,
    sortOrder: (last?.sortOrder || 0) + 1,
    isActive: true,
  });

  return NextResponse.json({ created: true, id: String(created._id) });
}
