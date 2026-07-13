import { requirePermission } from "@/lib/auth/require-permission";
import { authorizeAction } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxIncident from "@/lib/models/SymxIncident";

// Fields that only privileged (HR/Admin) viewers get to see. Everyone else
// gets the operational narrative (who/when/what/status) without the
// financial and legal detail.
const PRIVILEGED_FIELDS = [
  "claimNumber", "claimantLawyer", "statusDetail", "coverageDescription",
  "claimIncurred", "supervisorNotes", "paid", "reserved", "insurancePolicy",
  "insurancePolicyId", "withInsurance", "contactLog",
];

function redact(row: any) {
  const copy = { ...row };
  for (const f of PRIVILEGED_FIELDS) delete copy[f];
  return copy;
}

// Non-throwing check for whether the current user has full ("privileged")
// access — reuses the exact same gate the old admin-only incidents page
// used (HR view), so "privileged" here means "could see the old page."
async function hasFullAccess(): Promise<boolean> {
  try {
    await requirePermission("HR", "view");
    return true;
  } catch {
    return false;
  }
}

// GET /api/incidents?status=open|all&search=
// Any logged-in user (default-open via authorizeAction) can view the list.
// Non-privileged users get a redacted view — no claim $, lawyer, or
// insurance-policy detail.
export async function GET(req: NextRequest) {
  const auth = await authorizeAction("Incidents", "view");
  if (!auth.authorized) return auth.response;

  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "open";

    const query: any = {};
    if (status === "open") {
      // "Open" = anything not explicitly Closed — matches New + Open.
      query.claimStatus = { $ne: "Close" };
    }

    const rows = await SymxIncident.find(query).sort({ incidentDate: -1 }).lean();

    const canManage = await hasFullAccess();
    const result = canManage ? rows : rows.map(redact);

    return NextResponse.json({ incidents: result, canManage });
  } catch (error: any) {
    console.error("Error fetching incidents:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch incidents" }, { status: 500 });
  }
}

// POST /api/incidents — quick-create. Any logged-in user can report an
// incident (default-open via authorizeAction). Only the operational fields
// are accepted here — financial/legal fields are set to safe defaults and
// can only be filled in later by a privileged (HR/Admin) editor.
export async function POST(req: NextRequest) {
  const auth = await authorizeAction("Incidents", "create");
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();

    if (!body.transporterId || !String(body.transporterId).trim()) {
      return NextResponse.json({ error: "Employee is required" }, { status: 400 });
    }
    if (!body.claimType) {
      return NextResponse.json({ error: "Incident type is required" }, { status: 400 });
    }

    await connectToDatabase();

    const session = await getSession();

    const incident = await SymxIncident.create({
      transporterId: String(body.transporterId).trim().toUpperCase(),
      employeeName: body.employeeName || "",
      employeeId: body.employeeId || undefined,
      incidentDate: body.incidentDate ? new Date(body.incidentDate) : new Date(),
      reportedDate: new Date(),
      claimType: body.claimType,
      van: body.van || "",
      shortDescription: body.shortDescription || "",
      employeeNotes: body.employeeNotes || "",
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      policeReportFiled: !!body.policeReportFiled,
      policeReportNumber: body.policeReportNumber || "",
      medicalTreatmentRequired: !!body.medicalTreatmentRequired,
      medicalTreatmentType: body.medicalTreatmentType || "",
      witnesses: body.witnesses || "",
      thirdPartyInvolvementType: body.thirdPartyInvolvementType || "",
      claimStatus: "New",
      withInsurance: false,
      paid: 0,
      reserved: 0,
      createdBy: session?.email || "",
    });

    return NextResponse.json({ incident });
  } catch (error: any) {
    console.error("Error creating incident:", error);
    return NextResponse.json({ error: error.message || "Failed to create incident" }, { status: 500 });
  }
}
