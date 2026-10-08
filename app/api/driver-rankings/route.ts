import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { hasPermission, requirePermission } from "@/lib/auth/require-permission";
import { getRequestScope } from "@/lib/scoped-query";
import { loadDriverRankingData } from "@/lib/driver-ranking/driver-ranking-data";
import { publicDriverPerformanceSiteEnabled } from "@/lib/driver-ranking/driver-performance-public-config";

export async function GET(req: NextRequest) {
  let session: any;
  try {
    session = await requirePermission("Driver Dashboard", "view");
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: error.name === "ForbiddenError" ? 403 : 401 });
  }

  try {
    await connectToDatabase();
    const scope = await getRequestScope();
    if (scope.activeSiteIds.length !== 1) return NextResponse.json({ error: "Select one site." }, { status: 400 });
    const params = req.nextUrl.searchParams;
    const result = await loadDriverRankingData(scope.activeSiteIds[0], {
      week: params.get("week") || undefined,
      startDate: params.get("startDate") || undefined,
      endDate: params.get("endDate") || undefined,
    });
    const canEdit = await hasPermission(session, "Driver Dashboard", "edit");
    const publicDriverPerformanceEnabled = canEdit && await publicDriverPerformanceSiteEnabled(scope.activeSiteIds[0]);
    return NextResponse.json({ ...result, canEdit, publicDriverPerformanceEnabled });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Could not load driver ranking data." }, { status: 400 });
  }
}
