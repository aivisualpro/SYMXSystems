import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import InsurancePolicy from "@/lib/models/InsurancePolicy";

// GET /api/insurance/policies/lookup?date=YYYY-MM-DD
// A minimal, read-only policy list for linking a policy to an incident.
// Gated by HR edit (the same permission that lets someone manage incidents)
// rather than the Insurance module — so incident handlers can link a policy
// without needing full access to policy financials. Only identifying fields
// are returned, never claim/premium numbers.
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    const policies = await InsurancePolicy.find(
      {},
      { policyNumber: 1, company: 1, type: 1, startDate: 1, endDate: 1 }
    ).sort({ startDate: -1 }).lean();

    let rows = policies.map((p: any) => ({ ...p, _id: String(p._id), coversDate: false }));

    if (dateParam) {
      const d = new Date(dateParam);
      rows = rows.map((p: any) => ({
        ...p,
        coversDate: !!(p.startDate && p.endDate && d >= new Date(p.startDate) && d <= new Date(p.endDate)),
      }));
      // Policies that actually cover the incident date float to the top.
      rows.sort((a: any, b: any) => Number(b.coversDate) - Number(a.coversDate));
    }

    return NextResponse.json({ policies: rows });
  } catch (error: any) {
    console.error("Error looking up insurance policies:", error);
    return NextResponse.json({ error: error.message || "Failed to look up policies" }, { status: 500 });
  }
}
