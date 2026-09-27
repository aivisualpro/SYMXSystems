import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { authorizeAction } from "@/lib/rbac";
import { getRequestScope, resolveWriteSiteId } from "@/lib/scoped-query";
import { autoAssignVansForDay } from "@/lib/van-auto-assign";

// POST /api/dispatching/routes/auto-assign-vans — { date: "YYYY-MM-DD" }
// Fills in blank vans for the CURRENTLY SELECTED single station only
// (resolveWriteSiteId refuses to run if more than one station is in
// view, or none). Never touches a route that already has a van.
export async function POST(req: NextRequest) {
  const auth = await authorizeAction("Dispatching", "edit");
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const date = String(body?.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "A valid date (YYYY-MM-DD) is required" }, { status: 400 });
    }

    await connectToDatabase();

    const scope = await getRequestScope();
    const siteId = resolveWriteSiteId(scope, null);
    if (!siteId) {
      return NextResponse.json(
        { error: "Select a single station before running auto-assign." },
        { status: 400 }
      );
    }

    const result = await autoAssignVansForDay(siteId, date);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error auto-assigning vans:", error);
    return NextResponse.json({ error: error.message || "Failed to auto-assign vans" }, { status: 500 });
  }
}
