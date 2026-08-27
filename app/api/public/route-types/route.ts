import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import RouteType from "@/lib/models/RouteType";
import Site from "@/lib/models/Site";

// GET /api/public/route-types?station=CODE
//
// Route types for the public application form. Unauthenticated, so the
// station arrives as a query parameter and is validated against real,
// active stations rather than trusted.
//
// Requires a station rather than defaulting to one. Route types carry
// per-station start times, so returning DFO2's list to a DXC8 applicant
// would show them shifts that do not exist at the station they are
// applying to.
//
// Projected down to what a public form needs: an id and a name. Start
// times, costs and internal flags are not for an anonymous reader.
export async function GET(req: NextRequest) {
    await connectToDatabase();

    const code = (req.nextUrl.searchParams.get("station") || "").trim().toUpperCase();
    if (!code) {
        return NextResponse.json({ error: "A station is required." }, { status: 400 });
    }

    const site: any = await Site.findOne({ code, status: "active" }, { _id: 1 }).lean();
    if (!site) {
        return NextResponse.json({ error: "Unknown station." }, { status: 400 });
    }

    // Shared catalogue: the same route types exist at every station, so
    // the station is validated (it scopes the application itself) but does
    // not filter this list.
    const routes = await RouteType.find(
        { isActive: { $ne: false } },
        { _id: 1, name: 1 }
    ).sort({ sortOrder: 1, name: 1 }).lean();

    return NextResponse.json(routes);
}
