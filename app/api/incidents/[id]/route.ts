import { requirePermission } from "@/lib/auth/require-permission";
import { authorizeAction } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxIncident from "@/lib/models/SymxIncident";

const PRIVILEGED_FIELDS = [
  "claimNumber", "claimantLawyer", "statusDetail", "coverageDescription",
  "claimIncurred", "supervisorNotes", "paid", "reserved", "insurancePolicy",
  "insurancePolicyId", "withInsurance", "contactLog",
  "oshaRecordable", "dotRecordable", "daysMissedFromWork", "returnToWorkStatus",
  "returnToWorkDate", "thirdPartyInsuranceCarrier", "thirdPartyPolicyNumber",
  "thirdPartyAdjusterName", "thirdPartyAdjusterPhone", "thirdPartyClaimNumber",
];

// Fields anyone with basic "Incidents" edit access (any logged-in user, by
// default) may change — this is what lets a non-privileged user carry an
// incident they reported through its lifecycle. Includes the report-form
// fields (police report, medical treatment, witnesses, third-party type)
// since those are factual "what happened" details, not claim management.
const OPEN_EDIT_FIELDS = [
  "claimStatus", "employeeNotes", "shortDescription", "attachments",
  "policeReportFiled", "policeReportNumber", "medicalTreatmentRequired",
  "medicalTreatmentType", "witnesses", "thirdPartyInvolvementType",
  "bodyPartInjured",
];

// Fields that reassign or restate the core identity/financial/legal facts of
// the incident — HR/Admin only.
const PRIVILEGED_EDIT_FIELDS = [
  "transporterId", "employeeId", "employeeName", "claimantName", "claimNumber",
  "claimantLawyer", "statusDetail", "coverageDescription", "claimIncurred",
  "supervisorNotes", "thirdPartyName", "thirdPartyPhone", "thirdPartyEmail",
  "withInsurance", "insurancePolicy", "insurancePolicyId", "paid", "reserved",
  "incidentDate", "reportedDate", "claimType", "van",
  "oshaRecordable", "dotRecordable", "daysMissedFromWork", "returnToWorkStatus",
  "returnToWorkDate", "thirdPartyInsuranceCarrier", "thirdPartyPolicyNumber",
  "thirdPartyAdjusterName", "thirdPartyAdjusterPhone", "thirdPartyClaimNumber",
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

    // Fields that unset with $unset rather than $set — an empty string here
    // means "no policy/employee linked," and Mongoose can't cast "" to an
    // ObjectId (crashes with a BSONError), so these need to come out of the
    // update doc entirely rather than being set to "".
    const OBJECT_ID_FIELDS = ["insurancePolicyId", "employeeId"];
    const unsets: any = {};

    if (canManage) {
      for (const field of PRIVILEGED_EDIT_FIELDS) {
        if (body[field] === undefined) continue;
        if (field === "incidentDate" || field === "reportedDate" || field === "returnToWorkDate") {
          updates[field] = body[field] ? new Date(body[field]) : undefined;
        } else if (field === "paid" || field === "reserved" || field === "daysMissedFromWork") {
          updates[field] = body[field] === "" ? 0 : Number(body[field]);
        } else if (field === "oshaRecordable" || field === "dotRecordable") {
          updates[field] = !!body[field];
        } else if (OBJECT_ID_FIELDS.includes(field)) {
          if (body[field]) updates[field] = body[field];
          else unsets[field] = "";
        } else {
          updates[field] = body[field];
        }
      }
    }

    if (updates.claimStatus !== undefined && !VALID_STATUSES.includes(updates.claimStatus)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }

    // Contact/follow-up log — append-only, HR/Admin only (same tier as
    // supervisorNotes). e.g. "called the employee to check on their condition."
    let contactPush: any = null;
    if (body.newContactNote && canManage) {
      const session = await getSession();
      const note = body.newContactNote;
      if (!note.note || !String(note.note).trim()) {
        return NextResponse.json({ error: "Contact note text is required" }, { status: 400 });
      }
      contactPush = {
        date: new Date(),
        contactedBy: session?.email || "",
        method: note.method || "",
        note: String(note.note).trim(),
      };
    }

    if (Object.keys(updates).length === 0 && Object.keys(unsets).length === 0 && !contactPush) {
      return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
    }

    await connectToDatabase();
    const updateDoc: any = {};
    if (Object.keys(updates).length > 0) updateDoc.$set = updates;
    if (Object.keys(unsets).length > 0) updateDoc.$unset = unsets;
    if (contactPush) updateDoc.$push = { contactLog: contactPush };

    const incident = await SymxIncident.findByIdAndUpdate(id, updateDoc, { new: true, lean: true });
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
