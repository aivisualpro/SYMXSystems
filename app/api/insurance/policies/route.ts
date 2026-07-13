import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import InsurancePolicy from "@/lib/models/InsurancePolicy";
import SymxIncident from "@/lib/models/SymxIncident";

// GET /api/insurance/policies
// Admin-only. Returns every policy plus a computed rollup (from incidents
// actually linked to it in this app) alongside the manually-entered official
// numbers from the insurer's Loss Run report — the two are shown side by
// side rather than merged, since they may legitimately disagree.
export async function GET() {
  try {
    await requirePermission("Insurance", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const [policies, rollups] = await Promise.all([
      InsurancePolicy.find({}).sort({ type: 1, startDate: -1 }).lean(),
      SymxIncident.aggregate([
        { $match: { insurancePolicyId: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: "$insurancePolicyId",
            computedTotalClaims: { $sum: 1 },
            computedOpenClaims: {
              $sum: { $cond: [{ $ne: ["$claimStatus", "Close"] }, 1, 0] },
            },
            computedClaimsPaid: { $sum: { $ifNull: ["$paid", 0] } },
            computedClaimsIncurred: {
              $sum: { $add: [{ $ifNull: ["$paid", 0] }, { $ifNull: ["$reserved", 0] }] },
            },
          },
        },
      ]),
    ]);

    const rollupMap: Record<string, any> = {};
    rollups.forEach((r: any) => {
      rollupMap[String(r._id)] = {
        computedTotalClaims: r.computedTotalClaims || 0,
        computedOpenClaims: r.computedOpenClaims || 0,
        computedClaimsPaid: r.computedClaimsPaid || 0,
        computedClaimsIncurred: r.computedClaimsIncurred || 0,
      };
    });

    const rows = policies.map((p: any) => ({
      ...p,
      _id: String(p._id),
      ...(rollupMap[String(p._id)] || {
        computedTotalClaims: 0,
        computedOpenClaims: 0,
        computedClaimsPaid: 0,
        computedClaimsIncurred: 0,
      }),
    }));

    return NextResponse.json({ policies: rows });
  } catch (error: any) {
    console.error("Error fetching insurance policies:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch policies" }, { status: 500 });
  }
}

// POST /api/insurance/policies — create a new policy. Admin-only.
export async function POST(req: NextRequest) {
  try {
    await requirePermission("Insurance", "create");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body.policyNumber || !String(body.policyNumber).trim()) {
      return NextResponse.json({ error: "Policy number is required" }, { status: 400 });
    }

    await connectToDatabase();
    const session = await getSession();

    const lossRuns = [];
    if (body.lossRunFile) {
      lossRuns.push({
        url: body.lossRunFile,
        filename: body.lossRunFilename || "",
        uploadedAt: new Date(),
        uploadedBy: session?.email || "",
      });
    }

    const policy = await InsurancePolicy.create({
      policyNumber: String(body.policyNumber).trim(),
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      company: body.company || "",
      type: body.type || "Auto",
      lossRatio: body.lossRatio !== undefined && body.lossRatio !== "" ? Number(body.lossRatio) : undefined,
      claimsIncurred: body.claimsIncurred !== undefined && body.claimsIncurred !== "" ? Number(body.claimsIncurred) : undefined,
      claimsPaid: body.claimsPaid !== undefined && body.claimsPaid !== "" ? Number(body.claimsPaid) : undefined,
      premiumPaid: body.premiumPaid !== undefined && body.premiumPaid !== "" ? Number(body.premiumPaid) : undefined,
      totalClaims: body.totalClaims !== undefined && body.totalClaims !== "" ? Number(body.totalClaims) : undefined,
      openClaims: body.openClaims !== undefined && body.openClaims !== "" ? Number(body.openClaims) : undefined,
      policyLimit: body.policyLimit !== undefined && body.policyLimit !== "" ? Number(body.policyLimit) : undefined,
      lossRuns,
      notes: body.notes || "",
      createdBy: body.createdBy || session?.email || "",
    });

    return NextResponse.json({ policy });
  } catch (error: any) {
    console.error("Error creating insurance policy:", error);
    return NextResponse.json({ error: error.message || "Failed to create policy" }, { status: 500 });
  }
}
