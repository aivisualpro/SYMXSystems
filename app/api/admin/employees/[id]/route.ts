import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";

import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter, canAccessRecord, orgWide } from "@/lib/scoped-query";
import { getSession } from "@/lib/auth";
import SymxEmployee from "@/lib/models/SymxEmployee";
import { syncEmployeeSchedules, statusChangeNeedsSync } from "@/lib/scheduling/sync-employee-schedules";
import { isSchedulableStatus } from "@/lib/scheduling/employment-window";
import { canViewCompensation, maskRate } from "@/lib/compensation-visibility";

type RouteProps = {
  params: Promise<{ id: string }>;
};

// GET single employee
export async function GET(
  req: Request,
  props: RouteProps
) {
  try {
    await connectToDatabase();
    
    const session = await getSession();
    const role = session?.role;
    if (!role) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const params = await props.params;

    const employee = await SymxEmployee.findById(params.id);
    if (!employee) {
      return new NextResponse("Employee not found", { status: 404 });
    }

    // Pay rate is only visible to Super Admin / Owner-module-level access —
    // see lib/compensation-visibility.ts.
    const canViewComp = await canViewCompensation(session);
    return NextResponse.json(maskRate(employee.toObject(), canViewComp));
  } catch (error) {
    console.error("GET /api/admin/employees/[id] error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// UPDATE employee
export async function PUT(
  req: Request,
  props: RouteProps
) {
  try {
    await connectToDatabase();
    const session = await getSession();
    const role = session?.role;
    if (!role) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const params = await props.params;
    const body = await req.json();

    // Remove _id from body if present to avoid immutable field error (though mongoose handles it usually)
    delete body._id;

    // Pay rate is only visible/editable to Super Admin / Owner-module-level access —
    // see lib/compensation-visibility.ts. The edit form's Rate field is masked/blank
    // for anyone without that access, so a submitted `rate` from them isn't a real
    // intentional edit — drop it rather than let it overwrite the real value with
    // whatever the (masked) field happened to contain.
    const canViewComp = await canViewCompensation(session);
    if (!canViewComp) {
      delete body.rate;
    }

    // ── Home station ──
    // Editable, but only to a station the caller can reach — otherwise this
    // becomes a way to move someone somewhere the mover cannot see, leaving
    // them unrecoverable from that side. An empty value is dropped rather
    // than clearing the station, since unassigned reads as the default
    // station and would look like a silent move to DFO2.
    const editScope = await getRequestScope();
    if (body.primarySiteId !== undefined) {
      const requested = String(body.primarySiteId || "");
      if (!requested) {
        delete body.primarySiteId;
      } else if (!editScope.allowedSiteIds.includes(requested)) {
        return NextResponse.json(
          { error: "You don't have access to that station." },
          { status: 403 }
        );
      }
    }

    // Captured BEFORE the write so a status transition can be detected —
    // "became active today" is the trigger for generating forward, and it
    // is invisible once the update has landed.
    const previous = await SymxEmployee.findById(params.id, {
      status: 1, hiredDate: 1, terminationDate: 1, resignationDate: 1, primarySiteId: 1,
    }).lean();

    const updatedEmployee = await SymxEmployee.findByIdAndUpdate(
      params.id,
      body,
      { new: true, runValidators: true }
    );

    // ── Resync schedules when employment changes ──
    // Status, hire date, leaving date or station — each changes which days
    // this person should have rows for. An employee made active again
    // generates from the new active day FORWARD, never backfilling the
    // months they were away.
    if (updatedEmployee) {
      const p: any = previous || {};
      const n: any = updatedEmployee;
      const employmentChanged =
        statusChangeNeedsSync(p.status, n.status) ||
        String(p.hiredDate || "") !== String(n.hiredDate || "") ||
        String(p.terminationDate || "") !== String(n.terminationDate || "") ||
        String(p.resignationDate || "") !== String(n.resignationDate || "") ||
        String(p.primarySiteId || "") !== String(n.primarySiteId || "");

      if (employmentChanged) {
        try {
          // Becoming schedulable again starts a fresh window from today,
          // so the dormant period is not invented after the fact.
          const becameActive =
            !isSchedulableStatus(p.status) && isSchedulableStatus(n.status);
          if (becameActive && !n.reactivatedDate) {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            n.reactivatedDate = today;
            await SymxEmployee.updateOne(
              { _id: n._id },
              { $set: { reactivatedDate: today } }
            );
          }

          const sync = await syncEmployeeSchedules(n.toObject ? n.toObject() : n, {
            userId: (session as any)?.id,
          });
          if (sync.created || sync.removed) {
            console.log(
              `[employees] Schedule sync for ${n.transporterId}: ` +
              `+${sync.created} / -${sync.removed}`
            );
          }
        } catch (e: any) {
          console.error("[employees] Schedule sync failed after update:", e?.message);
        }
      }
    }

    if (!updatedEmployee) {
      return new NextResponse("Employee not found", { status: 404 });
    }

    return NextResponse.json(maskRate(updatedEmployee.toObject(), canViewComp));
  } catch (error: any) {
    console.error("PUT /api/admin/employees/[id] error:", error);
    if (error?.name === "ValidationError") {
      const message = Object.values(error.errors || {}).map((e: any) => e.message).join(", ") || "Validation failed";
      return new NextResponse(message, { status: 400 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// DELETE employee
export async function DELETE(
  req: Request,
  props: RouteProps
) {
  try {
    await connectToDatabase();
    const session = await getSession();
    const role = session?.role;
    // Only Admin can delete? Assuming all authenticated users with role can delete for now, or check role === 'Admin'
    if (!role) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const params = await props.params;

    const deletedEmployee = await SymxEmployee.findByIdAndDelete(params.id);

    if (!deletedEmployee) {
      return new NextResponse("Employee not found", { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/admin/employees/[id] error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
