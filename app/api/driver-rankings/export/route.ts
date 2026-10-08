import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { getRequestScope } from "@/lib/scoped-query";
import Site from "@/lib/models/Site";
import { loadDriverRankingData } from "@/lib/driver-ranking/driver-ranking-data";
import { driverRankingCsv, driverRankingFilename } from "@/lib/driver-ranking/driver-ranking-export";

export async function GET(req: NextRequest) {
  try { await requirePermission("Driver Dashboard", "view"); }
  catch (error: any) { return NextResponse.json({ error: error.message || "Unauthorized" }, { status: error.name === "ForbiddenError" ? 403 : 401 }); }
  try {
    await connectToDatabase();
    const scope = await getRequestScope();
    if (scope.activeSiteIds.length !== 1) return NextResponse.json({ error: "Select one site." }, { status: 400 });
    const week = req.nextUrl.searchParams.get("week") || "";
    if (!/^\d{4}-W\d{2}$/.test(week)) return NextResponse.json({ error: "Choose a valid reporting week." }, { status: 400 });
    const site = await Site.findById(scope.activeSiteIds[0], { code: 1 }).lean<any>();
    if (!site) return NextResponse.json({ error: "Site not found." }, { status: 404 });
    const result = await loadDriverRankingData(scope.activeSiteIds[0], { week });
    const code = String(site.code || "SITE").toUpperCase();
    return new NextResponse(`\uFEFF${driverRankingCsv(result, code)}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${driverRankingFilename(code, week)}"`, "X-Exported-Rows": String(result.drivers.length) } });
  } catch (error: any) { return NextResponse.json({ error: error.message || "Could not export driver rankings." }, { status: 400 }); }
}
