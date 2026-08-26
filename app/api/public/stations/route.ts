import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";

// GET /api/public/stations
//
// The station list for public forms — the HR ticket form and the
// interview application. Unauthenticated by necessity: these are filled
// in by people who have no account.
//
// Returns ONLY id, code and name. A station's address, its Quo number and
// which one is the default are internal details, and this endpoint is
// readable by anyone with the link.
//
// Active stations only, so a closed seasonal station drops out of the
// dropdown without anyone having to remember to remove it.

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    const sites = await Site.find(
      { status: "active" },
      { _id: 1, code: 1, name: 1 }
    )
      .sort({ code: 1 })
      .lean();

    return NextResponse.json({
      stations: sites.map((s: any) => ({
        id: String(s._id),
        code: s.code,
        name: s.name,
      })),
    });
  } catch (error: any) {
    console.error("Public stations error:", error);
    return NextResponse.json({ error: "Failed to load stations" }, { status: 500 });
  }
}
