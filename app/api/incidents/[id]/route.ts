import { requirePermission } from "@/lib/auth/require-permission";
import { authorizeAction } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SymxIncident from "@/lib/models/SymxIncident";

const PRIVILEGED_FIELDS = [
  "claimNumber", "claimantLawyer", "statusDetail", "coverageDescription",
  "claimIncurred", "supervisorNotes", "paid", "reserved", "insurancePolicy",
  "insurancePolicyId", "withInsurance",
];

// Fields anyone with basic "Incidents" edit access (any logged-in user, by
// default) may change — this is what lets a non-privileged user carry an
// incident they reported through its lifecycle.
const OPEN_EDIT_FIELDS = ["claimStatus", "employeeNotes", "shortDescription", "attachments"];

// Fields that reassign or restate the core facts of the incident (who, when,
// what, financial/legal handling) — HR/Admin only.
const PRIVILEGED_EDIT_FIELDS = [
  "transporterId", "employeeId", "employeeName", "claimantName", "claimNumber",
  "claimantLawyer", "statusDetail", "coverageDescription", "claimIncurred",
  "supervisorNotes", "thirdPartyName", "thirdPartyPhone", "thirdPartyEmail",
  "withInsurance", "insurancePolicy", "insurancePolicyId", "paid", "reserved",
  "incidentDate", "reportedDate", "claimType", "van",
];

const VALID_STATUSES = ["New", "Open", "Close"];

async function hasFullAccess(): Promise<boolean> {
  try {
    await requirePermission("HR", "view");
    return true;
  } catch {
    return false;
  }
}

function redact(row: any) {
  const copy = { ...row };
  for (const f of PRIVILEGED_FIELDS) delete copy[f];
  return copy;
}

// GET /api/incidents/[id] — single record, redacted for non-privileged users.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAction("Incidents", "view");
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    await connectToDatabase();
    const incident = await SymxIncident.findById(id).lean();
    if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

    const canManage = await hasFullAccess();
    return NextResponse.json({ incident: canManage ? incident : redact(incident), canManage });
  } catch (error: any) {
    console.error("Error fetching incident:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch incident" }, { status: 500 });
  }
}

// PUT /api/incidents/[id] — tiered edit. Any logged-in user can progress
// status / add notes / attachments on an incident; only privileged
// (HR/Admin) users can touch the financial/legal/identity fields. Any
// privileged-only field present in the body is silently dropped rather than
// rejecting the whole request, so a non-privileged user's status update
// still goes through even if the client sent extra fields.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAction("Incidents", "edit");
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const body = await req.json();
    const canManage = await hasFullAccess();

    const updates: any = {};

    for (const field of OPEN_EDIT_FIELDS) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    if (canManage) {
      for (const field of PRIVILEGED_EDIT_FIELDS) {
        if (body[field] === undefined) continue;
        if (field === "incidentDate" || field === "reportedDate") {
          updates[field] = body[field] ? new Date(body[field]) : undefined;
        } else if (field === "paid" || field === "reserved") {
          updates[field] = body[field] === "" ? 0 : Number(body[field]);
        } else {
          updates[field] = body[field];
        }
      }
    }

    if (updates.claimStatus !== undefined && !VALID_STATUSES.includes(updates.claimStatus)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
    }

    await connectToDatabase();
    const incident = await SymxIncident.findByIdAndUpdate(id, { $set: updates }, { new: true, lean: true });
    if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

    return NextResponse.json({ incident: canManage ? incident : redact(incident), canManage });
  } catch (error: any) {
    console.error("Error updating incident:", error);
    return NextResponse.json({ error: error.message || "Failed to update incident" }, { status: 500 });
  }
}

// DELETE /api/incidents/[id] — HR/Admin only.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("HR", "delete");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectToDatabase();
    const deleted = await SymxIncident.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting incident:", error);
    return NextResponse.json({ error: error.message || "Failed to delete incident" }, { status: 500 });
  }
}
