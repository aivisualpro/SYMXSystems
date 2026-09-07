import { requirePermission } from "@/lib/auth/require-permission";
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getSession } from "@/lib/auth";
import SymxEmployee from "@/lib/models/SymxEmployee";
import { syncEmployeeSchedules } from "@/lib/scheduling/sync-employee-schedules";

type RouteProps = {
  params: Promise<{ id: string }>;
};

// ── Manual schedule resync ──
//
// syncEmployeeSchedules() normally only runs at the moment an employment
// field changes (status, hire/leave date, transporter ID, or home station —
// see PUT /api/admin/employees/[id]). That works when the destination
// station already has its weeks generated. It does NOT work when someone
// is transferred to a station BEFORE that station has generated the week —
// the sync runs once, finds no SymxAvailableWeeks there, skips with a
// reason, and nothing ever re-triggers it once the station catches up.
// The employee is left permanently unscheduled at their new station until
// someone happens to re-save an employment field.
//
// This endpoint re-runs the same sync on demand, so a dispatcher can fix
// that case themselves once the destination station's week exists, without
// needing to toggle an unrelated field to force a resync.
export async function POST(req: Request, props: RouteProps) {
  try {
    await requirePermission("HR", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await props.params;
    const employee = await SymxEmployee.findById(id).lean();
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const result = await syncEmployeeSchedules(employee as any, {
      userId: (session as any)?.id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("POST /api/admin/employees/[id]/resync-schedule error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
