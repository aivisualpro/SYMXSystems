import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter, findScopedById, resolveWriteSiteId } from "@/lib/scoped-query";
import RouteType from "@/lib/models/RouteType";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";

// GET — list all route types
export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const scope = await getRequestScope();
        const S = siteFilter(scope, { includeUnassigned: true });
        const writeSiteId = resolveWriteSiteId(scope, null);
        const routes = await RouteType.find({}).sort({ sortOrder: 1, name: 1 }).lean();
        return NextResponse.json(routes);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — create or update route type
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
        const scope = await getRequestScope();
        const S = siteFilter(scope, { includeUnassigned: true });
        const writeSiteId = resolveWriteSiteId(scope, null);
        const body = await req.json();
        const { _id, name, color, startTime, theoryHrs, group, routeStatus, isDefault, partOf, isDA, isOps, isStandby, icon, sortOrder, isActive } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: "Route type name is required" }, { status: 400 });
        }

        if (_id) {
            // Fetch the existing record to detect startTime changes
            const existing = await findScopedById<any>(RouteType, _id, scope);
            if (!existing) return NextResponse.json({ error: "Route type not found" }, { status: 404 });

            // Update existing
            const updated = await RouteType.findByIdAndUpdate(
                _id,
                { name: name.trim(), color, startTime, theoryHrs, group, routeStatus, isDefault, partOf, isDA, isOps, isStandby, icon, sortOrder, isActive },
                { new: true }
            ).lean();
            if (!updated) return NextResponse.json({ error: "Route type not found" }, { status: 404 });

            // If startTime changed, propagate to all future schedules matching this route type
            let schedulesUpdated = 0;
            let schedulesUpdateSkipped = "";
            if (startTime !== undefined && existing.startTime !== startTime) {
                // ── Match by typeId, not a `type` name field ──
                // SymxEmployeeSchedule has no `type` string field — schedules
                // are keyed by `typeId` only (a stringified RouteType _id;
                // see lib/models/SymxEmployeeSchedule.ts). Matching on `type`
                // matched zero documents, every time, so this propagation
                // silently did nothing no matter how many times a start time
                // was changed — reported as "changing the start time doesn't
                // update future shifts of that type", which is exactly what
                // this dead filter looked like from the outside.
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);

                // ── This field is genuinely SHARED, org-wide — there is no
                // per-station override UI for it (RouteType.stations[]
                // exists in the schema but nothing here lets anyone edit
                // it). Someone changing this value while viewing a SINGLE
                // station overwhelmingly means "this station's start time",
                // not "the org-wide default" — so propagation is scoped to
                // `S` (their active station). But `S` is whatever stations
                // are currently active in THEIR site context, and for an
                // org admin viewing "all stations" that is every station —
                // so the exact same edit, intended for one station, silently
                // rewrote every other station's future schedules too. That
                // is precisely what put DXC8's 10:50 AM onto DFO2's board.
                // Refusing to propagate unless exactly one station is
                // active closes that hole; the value on the shared record
                // itself still saves either way.
                if (scope.activeSiteIds.length === 1) {
                    const result = await SymxEmployeeSchedule.updateMany(
                        {
                            ...S,
                            date: { $gte: today },
                            typeId: String(existing._id),
                        },
                        { $set: { startTime: startTime || "" } }
                    );
                    schedulesUpdated = result.modifiedCount;
                    console.log(`[Route Type] startTime changed for "${existing.name}": updated ${schedulesUpdated} future schedule(s)`);
                } else {
                    schedulesUpdateSkipped =
                        "Start time saved, but not pushed to any schedules: you're viewing more than one station, " +
                        "and this field has no per-station override yet — switch to the single station you mean before editing it.";
                    console.log(`[Route Type] startTime changed for "${existing.name}" while ${scope.activeSiteIds.length} stations were active — propagation skipped to avoid rewriting every station.`);
                }
            }

            return NextResponse.json({ ...updated, schedulesUpdated, ...(schedulesUpdateSkipped ? { schedulesUpdateSkipped } : {}) });
        } else {
            // Create new
            // No siteId: route types are a SHARED catalogue. Per-station
            // differences live in `stations[]` (start time, theory hours),
            // so a new type is immediately available everywhere rather than
            // being invisible at every station but the one that made it.
            const route = await RouteType.create({
                name: name.trim(),
                color: color || "#6B7280",
                startTime: startTime || "",
                theoryHrs: theoryHrs || 0,
                group: group || "None",
                routeStatus: routeStatus || "Scheduled",
                isDefault: isDefault ?? false,
                partOf: partOf || [],
                isDA: isDA ?? false,
                isOps: isOps ?? false,
                isStandby: isStandby ?? false,
                icon: icon || "",
                sortOrder: sortOrder ?? 0,
                isActive: isActive ?? true,
            });
            return NextResponse.json(route.toJSON());
        }
    } catch (error: any) {
        if (error.code === 11000) {
            return NextResponse.json({ error: "Route type with this name already exists" }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH — bulk reorder
export async function PATCH(req: NextRequest) {
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
        const scope = await getRequestScope();
        const S = siteFilter(scope, { includeUnassigned: true });
        const writeSiteId = resolveWriteSiteId(scope, null);
        const body = await req.json();

        if (Array.isArray(body)) {
            const bulkOps = body.filter(r => r._id).map((r: any) => ({
                updateOne: {
                    filter: { _id: r._id },
                    update: { $set: { sortOrder: r.sortOrder } }
                }
            }));
            if (bulkOps.length > 0) {
                await RouteType.bulkWrite(bulkOps);
            }
            return NextResponse.json({ success: true });
        }
        
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE — remove a route type
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
        const scope = await getRequestScope();
        const S = siteFilter(scope, { includeUnassigned: true });
        const writeSiteId = resolveWriteSiteId(scope, null);
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        await RouteType.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
