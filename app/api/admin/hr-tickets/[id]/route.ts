import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxHrTicket, { HrTicketStatus } from "@/lib/models/SymxHrTicket";

type RouteParams = { params: Promise<{ id: string }> };

// System-generated label for the timeline entry a status transition
// produces. On-hold gets its reason appended when one was provided.
const STATUS_CHANGE_LABEL: Record<HrTicketStatus, string> = {
  open: "Reopened",
  on_hold: "Put on hold",
  approved: "Approved",
  denied: "Denied",
  closed: "Closed",
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("HR", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const { id } = await params;
    const ticket = await SymxHrTicket.findById(id).lean();
    if (!ticket) return new NextResponse("Not Found", { status: 404 });
    return NextResponse.json(ticket);
  } catch (error) {
    console.error("[HR_TICKET_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
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
    if (!session?.role) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const body = await req.json();

    // status and activityNote are handled specially (they drive timeline
    // entries + legacy-field sync below); everything else in the body is a
    // plain field update ($set) — category, issue, notes, managersEmail,
    // employeeId/transporterId/employeeMatchType/suggestedEmployeeId
    // (employee linking), priority, assignedTo, resolution, holdReason,
    // attachment, etc.
    const { status, activityNote, activityType, ...rest } = body;

    const setDoc: Record<string, any> = { ...rest };
    const pushEntries: any[] = [];
    const byName: string = session.name || session.email || "System";
    const byEmail: string = session.email || "";

    if (status && STATUS_CHANGE_LABEL[status as HrTicketStatus]) {
      setDoc.status = status;
      // Keep the legacy approveDeny string in sync — the HR dashboard
      // (app/(protected)/hr/page.tsx) still computes its pending/approved/
      // denied counts directly from this field.
      if (status === "approved") setDoc.approveDeny = "Approve";
      else if (status === "denied") setDoc.approveDeny = "Deny";
      else if (status === "open" || status === "on_hold") setDoc.approveDeny = "";
      // "closed" intentionally leaves approveDeny untouched — closing
      // doesn't itself imply an approve/deny decision.

      if (status === "closed") {
        setDoc.closedBy = byEmail;
        setDoc.closedDateTime = new Date();
      } else {
        // Reopening/changing status away from closed clears the closed
        // markers so the card doesn't keep showing stale "Closed by" info.
        setDoc.closedBy = "";
        setDoc.closedDateTime = null;
      }

      const holdReasonSuffix = status === "on_hold" && rest.holdReason ? ` — ${rest.holdReason}` : "";
      pushEntries.push({
        type: "status_change",
        text: `${STATUS_CHANGE_LABEL[status as HrTicketStatus]}${holdReasonSuffix}`,
        byName,
        byEmail,
        createdAt: new Date(),
      });
    }

    if (typeof activityNote === "string" && activityNote.trim()) {
      pushEntries.push({
        type: activityType === "system" ? "system" : "note",
        text: activityNote.trim(),
        byName,
        byEmail,
        createdAt: new Date(),
      });
    }

    const update: Record<string, any> = {};
    if (Object.keys(setDoc).length > 0) update.$set = setDoc;
    if (pushEntries.length > 0) update.$push = { activity: { $each: pushEntries } };

    const ticket = Object.keys(update).length > 0
      ? await SymxHrTicket.findByIdAndUpdate(id, update, { new: true })
      : await SymxHrTicket.findById(id);

    if (!ticket) return new NextResponse("Not Found", { status: 404 });
    return NextResponse.json(ticket);
  } catch (error) {
    console.error("[HR_TICKET_PUT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("HR", "delete");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.role) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    await SymxHrTicket.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[HR_TICKET_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
