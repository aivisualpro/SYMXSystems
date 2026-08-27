import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter, resolveWriteSiteId, orgWide } from "@/lib/scoped-query";
import SYMXWSTOption from "@/lib/models/SYMXWSTOption";
import Site from "@/lib/models/Site";

// GET — list all WST options (no admin guard — read-only reference data used by dispatching)
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const scope = await getRequestScope();

        // The catalogue is SHARED — same selections at every station — so it
        // is not station-filtered. Only the rate differs, and that lives in
        // each option's rates[] array.
        const options = await SYMXWSTOption.find({}).sort({ sortOrder: 1, wst: 1 }).lean();

        // Stations the caller may edit rates for, so the UI renders one
        // column per station rather than hard-coding three.
        const sites = await Site.find(
            { _id: { $in: scope.allowedSiteIds }, status: "active" },
            { _id: 1, code: 1, name: 1 }
        ).sort({ code: 1 }).lean();

        return NextResponse.json({
            options,
            stations: sites.map((s: any) => ({ id: String(s._id), code: s.code, name: s.name })),
            // Older clients expect a bare array; they still get one from
            // `options` above rather than breaking on the new shape.
            legacy: options,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — create or update a WST option
export async function POST(req: NextRequest) {
  try {
    await requirePermission("Admin", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const body = await req.json();
        const { _id, wst, revenue, isActive, sortOrder, amazonServiceType, rates } = body;

        if (!wst?.trim()) {
            return NextResponse.json({ error: "WST is required" }, { status: 400 });
        }


        // ── Per-station rates ──
        // Only stations the caller can reach are accepted, so a rate cannot
        // be set for a station they have no access to. Anything else in the
        // payload is dropped rather than trusted.
        const scope = await getRequestScope();
        const cleanRates = Array.isArray(rates)
            ? rates
                  .filter((r: any) => r && scope.allowedSiteIds.includes(String(r.siteId)))
                  .map((r: any) => ({
                      siteId: r.siteId,
                      standard: parseFloat(r.standard) || 0,
                      over8: parseFloat(r.over8) || 0,
                  }))
            : undefined;

        if (_id) {
            const updated = await SYMXWSTOption.findByIdAndUpdate(
                _id,
                {
                    wst: wst.trim(),
                    revenue: parseFloat(revenue) || 0,
                    amazonServiceType: amazonServiceType ?? '',
                    isActive: isActive ?? true,
                    sortOrder: sortOrder ?? 0,
                    // Only replace rates when the client actually sent them,
                    // so a partial save cannot wipe every station's pricing.
                    ...(cleanRates ? { rates: cleanRates } : {}),
                },
                { new: true }
            ).lean();
            if (!updated) return NextResponse.json({ error: "Option not found" }, { status: 404 });
            return NextResponse.json(updated);
        } else {
            const option = await SYMXWSTOption.create({
                wst: wst.trim(),
                revenue: parseFloat(revenue) || 0,
                amazonServiceType: amazonServiceType ?? '',
                isActive: isActive ?? true,
                sortOrder: sortOrder ?? 0,
                rates: cleanRates ?? [],
            });
            return NextResponse.json(option.toJSON());
        }
    } catch (error: any) {
        if (error.code === 11000) {
            return NextResponse.json({ error: "This WST option already exists" }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE — remove a WST option
export async function DELETE(req: NextRequest) {
  try {
    await requirePermission("Admin", "delete");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        await SYMXWSTOption.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
