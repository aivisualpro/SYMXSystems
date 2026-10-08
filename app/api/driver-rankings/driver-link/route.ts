import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { getRequestScope } from "@/lib/scoped-query";
import SymxEmployee from "@/lib/models/SymxEmployee";
import { getOrCreateDriverPerformanceLink } from "@/lib/driver-ranking/driver-performance-link";
import { publicDriverPerformanceSiteEnabled } from "@/lib/driver-ranking/driver-performance-public-config";

const schema = z.object({ driverId: z.string().regex(/^[a-f0-9]{24}$/i) });

export async function POST(request: NextRequest) {
  let session: any;
  try { session = await requirePermission("Driver Dashboard", "edit"); }
  catch (error: any) { return NextResponse.json({ error: error.message || "Unauthorized" }, { status: error.name === "ForbiddenError" ? 403 : 401 }); }
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid driver." }, { status: 400 });
    await connectToDatabase();
    const scope = await getRequestScope();
    if (scope.activeSiteIds.length !== 1) return NextResponse.json({ error: "Select one site." }, { status: 400 });
    const siteId = scope.activeSiteIds[0];
    if (!(await publicDriverPerformanceSiteEnabled(siteId))) {
      return NextResponse.json({ error: "Public driver performance links are not enabled for this site." }, { status: 404 });
    }
    const employee = await SymxEmployee.findOne({ _id: parsed.data.driverId, primarySiteId: siteId }, { _id: 1 }).lean();
    if (!employee) return NextResponse.json({ error: "Driver not found." }, { status: 404 });
    const token = await getOrCreateDriverPerformanceLink(siteId, String(employee._id), String(session.id || session.email || "manager"));
    return NextResponse.json({ path: `/driver-performance/${token}` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Could not create driver link." }, { status: 400 });
  }
}
