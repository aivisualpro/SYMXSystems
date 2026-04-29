import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import RouteType from "@/lib/models/RouteType";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";

/** Compute current yearWeek (Sun-based) in Pacific Time. */
function getCurrentYearWeek(): string {
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
    const date = new Date(todayStr + "T00:00:00.000Z");
    const dayOfWeek = date.getUTCDay(); // 0=Sun … 6=Sat
    const sundayOfThisWeek = new Date(date);
    sundayOfThisWeek.setUTCDate(date.getUTCDate() - dayOfWeek);
    const year = sundayOfThisWeek.getUTCFullYear();
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const jan1Day = jan1.getUTCDay();
    const firstSunday = new Date(jan1);
    firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
    const diffMs = sundayOfThisWeek.getTime() - firstSunday.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    const weekNum = Math.floor(diffDays / 7) + 1;
    return `${year}-W${weekNum.toString().padStart(2, "0")}`;
}

// GET — list all route types
export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectToDatabase();
        const routes = await RouteType.find().sort({ sortOrder: 1, name: 1 }).lean();
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
        const body = await req.json();
        const { _id, name, color, startTime, theoryHrs, group, routeStatus, icon, sortOrder, isActive } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: "Route type name is required" }, { status: 400 });
        }

        if (_id) {
            // Fetch the existing record to detect startTime changes
            const existing = await RouteType.findById(_id).lean();
            if (!existing) return NextResponse.json({ error: "Route type not found" }, { status: 404 });

            // Update existing
            const updated = await RouteType.findByIdAndUpdate(
                _id,
                { name: name.trim(), color, startTime, theoryHrs, group, routeStatus, icon, sortOrder, isActive },
                { new: true }
            ).lean();
            if (!updated) return NextResponse.json({ error: "Route type not found" }, { status: 404 });

            // If startTime changed, propagate to all current-week schedules matching this route type
            let schedulesUpdated = 0;
            if (startTime !== undefined && existing.startTime !== startTime) {
                const currentWeek = getCurrentYearWeek();
                const typeName = (existing.name || "").trim();
                if (typeName) {
                    const result = await SymxEmployeeSchedule.updateMany(
                        {
                            yearWeek: { $gte: currentWeek },
                            type: { $regex: new RegExp(`^${typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                        },
                        { $set: { startTime: startTime || "" } }
                    );
                    schedulesUpdated = result.modifiedCount;
                    console.log(`[Route Type] startTime changed for "${typeName}": updated ${schedulesUpdated} schedules in ${currentWeek}+`);
                }
            }

            return NextResponse.json({ ...updated, schedulesUpdated });
        } else {
            // Create new
            const route = await RouteType.create({
                name: name.trim(),
                color: color || "#6B7280",
                startTime: startTime || "",
                theoryHrs: theoryHrs || 0,
                group: group || "None",
                routeStatus: routeStatus || "Scheduled",
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
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        await RouteType.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
