import { requirePermission } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SYMXRoute from "@/lib/models/SYMXRoute";

const PAYCOM_FIELDS = ["paycomInDay", "paycomOutLunch", "paycomInLunch", "paycomOutDay"];

// POST /api/dispatching/time/punch-import/commit
// Writes the "clean" (non-duplicate, matched) records produced by
// /api/dispatching/time/punch-import onto their matching SYMXRoute documents.
// Records may be PARTIAL (e.g. only In Day punched so far, mid-shift) — only the
// punch fields actually present on each record are $set; fields the record doesn't
// know about are left untouched, so an earlier upload's data is never blanked out
// by a later, still-incomplete upload. No upsert — every record here was already
// confirmed to have a matching route during the preview step.
export async function POST(req: NextRequest) {
  try {
    await requirePermission("Dispatching", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { records } = await req.json();
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "No records provided" }, { status: 400 });
    }

    await connectToDatabase();

    const ops = records
      .map((r: any) => {
        const setFields: Record<string, string> = {};
        for (const field of PAYCOM_FIELDS) {
          if (r[field] !== undefined) setFields[field] = r[field];
        }
        if (Object.keys(setFields).length === 0) return null;
        return {
          updateOne: {
            filter: { transporterId: r.transporterId, date: new Date(r.date) },
            update: { $set: setFields },
          },
        };
      })
      .filter(Boolean) as any[];

    if (ops.length === 0) {
      return NextResponse.json({ error: "No valid punch fields to write" }, { status: 400 });
    }

    const result = await SYMXRoute.bulkWrite(ops, { ordered: false });

    return NextResponse.json({
      success: true,
      updated: result.modifiedCount || 0,
      matched: result.matchedCount || 0,
    });
  } catch (error: any) {
    console.error("[Punch Import Commit] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to write punch data" }, { status: 500 });
  }
}
