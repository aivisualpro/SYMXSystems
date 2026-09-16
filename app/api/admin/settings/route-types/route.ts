import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/db";
import { getRequestScope, siteFilter, findScopedById, resolveWriteSiteId } from "@/lib/scoped-query";
import RouteType, { routeTypeStartTime, routeTypeTheoryHrs } from "@/lib/models/RouteType";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";

// GET — list all route types
export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const scope = await getRequestScope();
        // Exactly one station in view → show ITS start time/theory hours
        // (its stations[] override, falling back to the shared default),
        // not the raw shared field. Viewing "All Stations" (0 or 2+ active)
        // has no single station to resolve for, so the shared field itself
        // is shown — that is genuinely what's being edited in that view.
        const writeSiteId = resolveWriteSiteId(scope, null);
        const routes = await RouteType.find({}).sort({ sortOrder: 1, name: 1 }).lean();
        const resolved = (routes as any[]).map((r) => ({
            ...r,
            ...(writeSiteId
                ? { startTime: routeTypeStartTime(r, writeSiteId), theoryHrs: routeTypeTheoryHrs(r, writeSiteId) }
                : {}),
        }));
        return NextResponse.json(resolved);
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

            // Start time and theory hours are the two fields that genuinely
            // vary by station (RouteType.stations[]) — everything else
            // (name, color, grouping, flags...) is the shared catalogue
            // entry and always written at the top level.
            const sharedFields = { name: name.trim(), color, group, routeStatus, isDefault, partOf, isDA, isOps, isStandby, icon, sortOrder, isActive };

            // What this station was seeing before the edit — resolved
            // through the same override-then-fallback logic used
            // everywhere else, so the comparison below is apples-to-apples
            // regardless of whether this station already had an override.
            const previousEffectiveStartTime = routeTypeStartTime(existing, writeSiteId);

            let updated: any;
            if (writeSiteId) {
                // ── Exactly one station in view: write ITS override ──
                // RouteType.stations[] already existed in the schema for
                // exactly this, but nothing ever wrote to it — every edit
                // here landed on the shared field, so "DXC8's start time"
                // and "DFO2's start time" were actually the same value the
                // whole time; changing one changed both the moment either
                // was viewed. This is the fix: the value shown/edited while
                // a single station is active now lives in that station's
                // own stations[] entry, never the shared default.
                await RouteType.updateOne({ _id }, { $set: sharedFields });

                const siteObjectId = new mongoose.Types.ObjectId(writeSiteId);
                const hasOverride = (existing.stations || []).some(
                    (s: any) => String(s.siteId) === String(writeSiteId)
                );
                if (hasOverride) {
                    await RouteType.updateOne(
                        { _id, "stations.siteId": siteObjectId },
                        { $set: { "stations.$.startTime": startTime || "", "stations.$.theoryHrs": theoryHrs || 0 } }
                    );
                } else {
                    await RouteType.updateOne(
                        { _id },
                        { $push: { stations: { siteId: siteObjectId, startTime: startTime || "", theoryHrs: theoryHrs || 0 } } }
                    );
                }
                updated = await RouteType.findById(_id).lean();
            } else {
                // Viewing 0 or 2+ stations: no single station to attach an
                // override to, so this edits the shared default itself —
                // the value any station without its own override falls
                // back to.
                updated = await RouteType.findByIdAndUpdate(
                    _id,
                    { ...sharedFields, startTime, theoryHrs },
                    { new: true }
                ).lean();
            }
            if (!updated) return NextResponse.json({ error: "Route type not found" }, { status: 404 });

            // If the EFFECTIVE start time for the station being edited
            // changed, propagate to that station's own future schedules.
            let schedulesUpdated = 0;
            let schedulesUpdateSkipped = "";
            const newEffectiveStartTime = writeSiteId ? routeTypeStartTime(updated, writeSiteId) : (startTime ?? updated.startTime);
            if (startTime !== undefined && previousEffectiveStartTime !== newEffectiveStartTime) {
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

                if (writeSiteId) {
                    // Scoped to the EXACT station being edited, not the
                    // broader `S` (which, with includeUnassigned, can also
                    // reach pre-migration unassigned rows). Editing DXC8's
                    // override must only ever touch DXC8's own schedule
                    // rows — never DFO2's, and never anyone else's.
                    const result = await SymxEmployeeSchedule.updateMany(
                        {
                            siteId: new mongoose.Types.ObjectId(writeSiteId),
                            date: { $gte: today },
                            typeId: String(existing._id),
                        },
                        { $set: { startTime: newEffectiveStartTime || "" } }
                    );
                    schedulesUpdated = result.modifiedCount;
                    console.log(`[Route Type] startTime changed for "${existing.name}" at site ${writeSiteId}: updated ${schedulesUpdated} future schedule(s)`);
                } else {
                    schedulesUpdateSkipped =
                        "Start time saved, but not pushed to any schedules: you're viewing more than one station, " +
                        "so there's no single station to update — switch to the one station you mean and it will push automatically.";
                    console.log(`[Route Type] shared startTime changed for "${existing.name}" while ${scope.activeSiteIds.length} stations were active — propagation skipped (ambiguous target).`);
                }
            }

            return NextResponse.json({ ...updated, startTime: newEffectiveStartTime, schedulesUpdated, ...(schedulesUpdateSkipped ? { schedulesUpdateSkipped } : {}) });
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
