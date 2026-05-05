import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SYMXRoutesInfo from "@/lib/models/SYMXRoutesInfo";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxEmployee from "@/lib/models/SymxEmployee";
import ScheduleAuditLog from "@/lib/models/ScheduleAuditLog";
import SYMXSetting from "@/lib/models/SYMXSetting";
import SymxUser from "@/lib/models/SymxUser";
import Vehicle from "@/lib/models/Vehicle";


import RouteType from "@/lib/models/RouteType";
import { z } from "zod";
import { validateBody, validateSearchParams } from "@/lib/validations";
import { authorizeAction } from "@/lib/rbac";

const routesQuerySchema = z.object({
    yearWeek: z.string().min(1),
    date: z.string().optional().nullable(),
    checkOnly: z.enum(["true", "false"]).optional().nullable()
});

const generateRoutesSchema = z.object({
    yearWeek: z.string().min(1),
    regenerate: z.boolean().optional()
});

const updateRouteSchema = z.object({
    routeId: z.string().min(1),
    updates: z.record(z.string(), z.any())
});

const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Business timezone — all date computations use Pacific Time */
const BUSINESS_TZ = "America/Los_Angeles";

// Resolve performer name from session, with DB fallback
async function resolvePerformerName(session: any): Promise<{ email: string; name: string }> {
    const email = session?.email || "unknown";
    const sessionName = session?.name || "";
    if (sessionName && sessionName.length > 1) {
        return { email, name: sessionName };
    }
    try {
        const user = await SymxUser.findOne({ email: email.toLowerCase() }, { name: 1 }).lean() as any;
        if (user?.name) {
            return { email, name: user.name };
        }
    } catch { }
    return { email, name: email };
}

// GET: Fetch routes for a yearWeek (with employee name enrichment + audit counts)
export async function GET(req: NextRequest) {
  try {
    await requirePermission("Dispatching", "view");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        const auth = await authorizeAction("Dispatching", "view");
        if (!auth.authorized) return auth.response;

        const validation = validateSearchParams(routesQuerySchema, req);
        if (!validation.success) {
            return validation.response;
        }

        const { yearWeek, date, checkOnly } = validation.data;

        await connectToDatabase();

        // Fast path: layout just needs to know if routes exist (no full data fetch)
        if (checkOnly === "true") {
            const count = await SYMXRoute.countDocuments({ yearWeek });
            return NextResponse.json({ routesGenerated: count > 0 });
        }

        // Fetch RouteType metadata — filter to only those with "Dispatching" in partOf
        const allRouteTypes = await RouteType.find({}, { _id: 1, name: 1, routeStatus: 1, partOf: 1 }).lean() as any[];
        const rtNameToId = new Map<string, string>();   // name.lower → typeId string

        // Only include typeIds that have "Dispatching" in partOf AND are not "Off"
        const dispatchingTypeIds: string[] = [];
        const offTypeIds: string[] = [];

        for (const rt of allRouteTypes) {
            const id = String(rt._id);
            rtNameToId.set((rt.name || "").trim().toLowerCase(), id);
            const partOf: string[] = Array.isArray(rt.partOf) ? rt.partOf : [];
            const isDispatchingType = partOf.includes("Dispatching");
            const isOff = ["off", "Off", "OFF"].includes(rt.routeStatus || "");

            if (isDispatchingType && !isOff) {
                dispatchingTypeIds.push(id);
            } else {
                offTypeIds.push(id); // everything else is excluded
            }
        }

        // Build query — only show routes whose typeId is a Dispatching-partOf, non-Off RouteType
        // Match both string AND ObjectId stored values (handles pre-migration records)
        const query: any = { yearWeek };
        if (date) query.date = new Date(date);
        if (dispatchingTypeIds.length > 0) {
            const asObjectIds = dispatchingTypeIds
                .map(id => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } })
                .filter(Boolean);
            query.$or = [
                { typeId: { $in: dispatchingTypeIds } },        // stored as string
                { typeId: { $in: asObjectIds } },               // stored as ObjectId
            ];
        } else {
            // No valid dispatching types configured — return nothing
            query.typeId = { $in: [] };
        }

        // ── PHASE 1: Fetch routes + completion setting in parallel ──
        const [routes, completionSetting] = await Promise.all([
            SYMXRoute.find(query).sort({ date: 1, transporterId: 1 }).lean(),
            SYMXSetting.findOne({ key: "routes_completion_types" }).lean(),
        ]);

        if (routes.length === 0) {
            return NextResponse.json({ routes: [], employees: {}, routesGenerated: false });
        }

        // Extract unique IDs for lookups and normalize the route docs inline
        const transporterIdsSet = new Set<string>();
        routes.forEach((r: any) => {
            if (r.transporterId) {
                r.transporterId = r.transporterId.trim().toUpperCase();
                transporterIdsSet.add(r.transporterId);
            }
        });
        const transporterIds = [...transporterIdsSet];
        const allVins = [...new Set(routes.map((r: any) => r.van).filter(Boolean))];

        // Build completion types filter using typeId
        const completionTypeIds: string[] = Array.isArray(completionSetting?.value) && (completionSetting as any).value.length > 0
            ? (completionSetting as any).value
                .map((t: string) => rtNameToId.get(t.toLowerCase().trim()))
                .filter(Boolean)
            : [];
        const routeCountMatch: any = { transporterId: { $in: transporterIds } };
        if (completionTypeIds.length > 0) {
            routeCountMatch.typeId = { $in: completionTypeIds };
        } else {
            routeCountMatch.typeId = { $exists: true, $ne: "" };
        }

        // Use exact match since IDs are normalized, avoiding expensive dynamic map of 150 regexes
        const [employees, routeCountsByDate, auditCountsRaw, vehicleDocs, confirmationDocs] = await Promise.all([
            SymxEmployee.find(
                { transporterId: { $in: transporterIds } },
                { transporterId: 1, firstName: 1, lastName: 1, phoneNumber: 1, type: 1, profileImage: 1, routesComp: 1, rate: 1, hiredDate: 1 }
            ).lean(),
            SYMXRoute.aggregate([
                { $match: routeCountMatch },
                { $group: { _id: { transporterId: "$transporterId", date: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: BUSINESS_TZ } } }, count: { $sum: 1 } } },
            ]),
            ScheduleAuditLog.aggregate([
                { $match: { yearWeek } },
                { $group: { _id: "$transporterId", count: { $sum: 1 } } },
            ]),
            allVins.length > 0
                ? Vehicle.find({ vin: { $in: allVins } }, { vin: 1, vehicleName: 1 }).lean()
                : [],
            // Fetch schedules linked to these routes (for shiftNotification status)
            (() => {
                const scheduleIds = routes
                    .map((r: any) => r.scheduleId)
                    .filter(Boolean)
                    .map((id: string) => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } })
                    .filter(Boolean);

                if (scheduleIds.length === 0) return Promise.resolve([]);
                return SymxEmployeeSchedule.find(
                    { _id: { $in: scheduleIds } },
                    { transporterId: 1, date: 1, shiftNotification: 1 }
                ).lean();
            })()
        ]);

        // ── Build maps (all O(n), very fast) ──
        const employeeMap: Record<string, any> = {};
        const initialCompMap: Record<string, number> = {};
        employees.forEach((emp: any) => {
            const normalizedTid = (emp.transporterId || "").trim().toUpperCase();
            employeeMap[normalizedTid] = {
                name: `${emp.firstName} ${emp.lastName}`.toUpperCase(),
                firstName: emp.firstName,
                lastName: emp.lastName,
                phoneNumber: emp.phoneNumber || "",
                type: emp.type || "",
                profileImage: emp.profileImage || "",
                rate: emp.rate || 0,
                hiredDate: emp.hiredDate || null,
            };
            initialCompMap[normalizedTid] = parseInt(emp.routesComp) || 0;
        });

        // Build per-employee per-date count map: { transporterId: { "2026-03-15": 1, ... } }
        const routeDateMap: Record<string, Record<string, number>> = {};
        // Also build the flat total for backward compatibility
        const routeCountMap: Record<string, number> = {};
        routeCountsByDate.forEach((rc: any) => {
            const tid = rc._id.transporterId;
            const dt = rc._id.date;
            if (!routeDateMap[tid]) routeDateMap[tid] = {};
            routeDateMap[tid][dt] = rc.count;
            routeCountMap[tid] = (routeCountMap[tid] || 0) + rc.count;
        });
        // Add initial routesComp
        Object.entries(initialCompMap).forEach(([tid, initVal]) => {
            if (initVal > 0) {
                routeCountMap[tid] = (routeCountMap[tid] || 0) + initVal;
            }
        });

        const auditCounts: Record<string, number> = {};
        auditCountsRaw.forEach((c: any) => { auditCounts[c._id] = c.count; });

        const vehicleNames: Record<string, string> = {};
        (vehicleDocs as any[]).forEach((v: any) => {
            if (v.vin && v.vehicleName) vehicleNames[v.vin] = v.vehicleName;
        });

        // ── Build Confirmation Status Map ──
        // Single source: shiftNotification[] from SYMXEmployeeSchedules
        // Contains full timeline: sent → received → confirmed (after migration)
        const confirmationMap: Record<string, any> = {};

        (confirmationDocs as any[]).forEach((sched: any) => {
            const arr: any[] = Array.isArray(sched.shiftNotification) ? sched.shiftNotification : [];
            if (arr.length === 0) return;
            const tid = (sched.transporterId || "").trim().toUpperCase();
            const dateStr = sched.date ? new Date(sched.date).toISOString().split('T')[0] : "";
            const key = `${tid}_${dateStr}`;

            const history = arr.map((entry: any) => ({
                status: entry.status || "pending",
                changeRemarks: entry.changeRemarks || "",
                updatedAt: entry.createdAt || new Date(),
                messageType: "shift",
            })).sort((a: any, b: any) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

            // Find the highest-priority status: confirmed > change_requested > received > sent > pending
            const statusPriority: Record<string, number> = { confirmed: 5, change_requested: 4, received: 3, delivered: 2, sent: 1, pending: 0 };
            let bestEntry = arr[arr.length - 1]; // default to last
            let bestPriority = -1;
            for (const entry of arr) {
                const p = statusPriority[entry.status] ?? -1;
                if (p > bestPriority) { bestPriority = p; bestEntry = entry; }
            }

            confirmationMap[key] = {
                status: bestEntry.status || "pending",
                changeRemarks: bestEntry.changeRemarks || "",
                updatedAt: bestEntry.createdAt || new Date(),
                messageType: "shift",
                history,
            };
        });

        return NextResponse.json({
            routes,
            employees: employeeMap,
            routeCounts: routeCountMap,
            routeCountsByDate: routeDateMap,
            initialRoutesComp: initialCompMap,
            auditCounts,
            vehicleNames,
            confirmations: confirmationMap,
            routesGenerated: true,
        });
    } catch (error: any) {
        console.error("Error fetching routes:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch routes" }, { status: 500 });
    }
}

// POST: Generate route records for a yearWeek (from scheduled employees)
export async function POST(req: NextRequest) {
  try {
    await requirePermission("Dispatching", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        const auth = await authorizeAction("Dispatching", "create");
        if (!auth.authorized) return auth.response;

        const rawBody = await req.json();
        const validation = validateBody(generateRoutesSchema, rawBody);
        if (!validation.success) {
            return validation.response;
        }
        
        const { yearWeek, regenerate } = validation.data;

        await connectToDatabase();

        // Check if routes already exist for this week
        const existingCount = await SYMXRoute.countDocuments({ yearWeek });
        if (existingCount > 0 && !regenerate) {
            return NextResponse.json({
                message: "Routes already generated for this week",
                count: existingCount,
                created: 0,
            });
        }

        // If regenerating, delete existing routes first so they are re-created from fresh schedule data
        if (existingCount > 0 && regenerate) {
            console.log(`[Generate Routes] Regenerating: deleting ${existingCount} existing routes for ${yearWeek}`);
            await SYMXRoute.deleteMany({ yearWeek });
        }

        // Fetch all schedules for this week — only fields needed for route generation
        const schedules = await SymxEmployeeSchedule.find(
            { yearWeek },
            { _id: 1, transporterId: 1, date: 1, weekDay: 1, typeId: 1, van: 1 }
        ).lean();

        console.log(`[Generate Routes] Found ${schedules.length} schedule records for ${yearWeek}`);

        if (schedules.length === 0) {
            return NextResponse.json({ error: "No schedules found for this week" }, { status: 404 });
        }

        // Build RouteType map: typeId → { routeStatus, partOf }
        const routeTypes = await RouteType.find({}, { _id: 1, routeStatus: 1, partOf: 1 }).lean() as any[];
        const typeIdToMeta = new Map<string, { routeStatus: string; partOf: string[] }>();
        for (const rt of routeTypes) {
            typeIdToMeta.set(String(rt._id), {
                routeStatus: (rt.routeStatus || "").toLowerCase(),
                partOf: Array.isArray(rt.partOf) ? rt.partOf : [],
            });
        }

        // Filter: keep only schedules where typeId resolves to a RouteType that:
        //   1. Has routeStatus !== "off"
        //   2. Has "Dispatching" in its partOf array
        const workingSchedules = schedules.filter((s: any) => {
            if (!s.typeId) return false;
            const meta = typeIdToMeta.get(String(s.typeId));
            if (!meta) return false;
            if (meta.routeStatus === "off") return false;
            return meta.partOf.includes("Dispatching");
        });

        console.log(`[Generate Routes] ${schedules.length} total schedules, ${workingSchedules.length} working (excluded empty/Off)`);

        if (workingSchedules.length === 0) {
            return NextResponse.json({
                message: "No valid schedules found for this week (all entries are empty)",
                count: 0,
                created: 0,
            });
        }

        // Create route records — one per working schedule entry (typeId only, no type/subType)
        // Use bulkWrite with upserts to handle the unique {transporterId, date} index gracefully
        const db = mongoose.connection.db!;
        const routesCol = db.collection("SYMXRoutes");

        const bulkOps = workingSchedules.map((s: any) => ({
            updateOne: {
                filter: { transporterId: s.transporterId, date: s.date },
                update: {
                    $set: {
                        scheduleId: String(s._id),
                        weekDay: s.weekDay,
                        yearWeek,
                        typeId: s.typeId ? String(s.typeId) : "",
                    },
                    // Only set van on NEW inserts — never overwrite existing van assignments
                    $setOnInsert: {
                        van: s.van || "",
                        serviceType: "",
                        dashcam: "",
                    },
                },
                upsert: true,
            },
        }));

        const result = await routesCol.bulkWrite(bulkOps, { ordered: false });
        const createdCount = (result.upsertedCount || 0) + (result.modifiedCount || 0);
        console.log(`[Generate Routes] bulkWrite result: upserted=${result.upsertedCount}, modified=${result.modifiedCount}, total=${createdCount}`);

        // ══════════════════════════════════════════════════════════
        // ── RE-APPLY ROUTES INFO DATA ──
        // After generating/regenerating routes, re-apply any existing
        // RoutesInfo data (routeNumber, stops, packages, etc.) that was
        // previously entered via the Routes Info panel.
        // ══════════════════════════════════════════════════════════
        try {
            await reApplyRoutesInfo(yearWeek, workingSchedules);
        } catch (err: any) {
            console.error("[Re-Apply RoutesInfo] Error:", err.message);
        }

        // ══════════════════════════════════════════════════════════
        // ── AUTO VAN ASSIGNMENT ──
        // Only for routes still without a van after RoutesInfo re-apply.
        // ══════════════════════════════════════════════════════════
        try {
            await autoAssignVans(yearWeek);
        } catch (err: any) {
            console.error("[Auto Van Assignment] Error:", err.message);
        }

        return NextResponse.json({
            message: `Generated ${createdCount} route records for ${yearWeek}`,
            count: createdCount,
            created: createdCount,
        });
    } catch (error: any) {
        console.error("Error generating routes:", error);
        return NextResponse.json({ error: error.message || "Failed to generate routes" }, { status: 500 });
    }
}

// ══════════════════════════════════════════════════════════
// RE-APPLY ROUTES INFO DATA
// ══════════════════════════════════════════════════════════
// After routes are generated/regenerated, fetch any existing
// SYMXRoutesInfo rows (from the Routes Info panel) that have
// a linked transporterId and re-apply their fields to the
// corresponding SYMXRoute records.
// ══════════════════════════════════════════════════════════
async function reApplyRoutesInfo(yearWeek: string, schedules: any[]) {
    // Collect unique dates from the schedules
    const dateSet = new Set<string>();
    for (const s of schedules) {
        if (s.date) {
            const d = new Date(s.date);
            dateSet.add(d.toISOString().split("T")[0]);
        }
    }

    if (dateSet.size === 0) return;

    // Query all RoutesInfo rows for these dates that have a transporterId
    const dateObjects = [...dateSet].map(d => new Date(d));
    const routesInfoRows = await SYMXRoutesInfo.find({
        date: { $in: dateObjects },
        transporterId: { $nin: ["", null] },
    }).lean() as any[];

    if (routesInfoRows.length === 0) {
        console.log("[Re-Apply RoutesInfo] No linked RoutesInfo rows to re-apply");
        return;
    }

    // Build bulk update ops for SYMXRoute
    const updateOps = routesInfoRows.map((row: any) => ({
        updateOne: {
            filter: { transporterId: row.transporterId, date: row.date },
            update: {
                $set: {
                    routeNumber: row.routeNumber || "",
                    stopCount: row.stopCount ? parseInt(row.stopCount) || 0 : 0,
                    packageCount: row.packageCount ? parseInt(row.packageCount) || 0 : 0,
                    routeDuration: row.routeDuration || "",
                    waveTime: row.waveTime || "",
                    pad: row.pad || "",
                    wst: row.wst || "",
                    wstDuration: row.wstDuration ? parseInt(row.wstDuration) || 0 : 0,
                    bags: row.bags || "",
                    ov: row.ov || "",
                    stagingLocation: row.stagingLocation || "",
                },
            },
        },
    }));

    const result = await SYMXRoute.bulkWrite(updateOps, { ordered: false });
    console.log(`[Re-Apply RoutesInfo] Re-applied ${result.modifiedCount} route(s) from ${routesInfoRows.length} RoutesInfo rows`);
}

// ══════════════════════════════════════════════════════════
// AUTO VAN ASSIGNMENT ALGORITHM
// ══════════════════════════════════════════════════════════
// For each size category (SP XL, SP L):
//   1. Find routes: type in ["Route","Training OTR"], van is empty
//   2. Split by employee experience: untrained (<90 days) vs trained
//   3. Get available vans: Active vehicles with matching serviceType,
//      not already assigned to any route in this week
//   4. Assign: untrained first, then trained
//   5. Auto-populate: serviceType + dashcam from vehicle
// ══════════════════════════════════════════════════════════
async function autoAssignVans(yearWeek: string) {
    const SIZE_CATEGORIES = ["SP XL", "SP L"];
    const NINETY_DAYS_AGO = new Date();
    NINETY_DAYS_AGO.setDate(NINETY_DAYS_AGO.getDate() - 90);

    // Resolve eligible typeIds (non-"off" route status routes with van assignment intent)
    // We fetch all route types and find IDs whose routeStatus is not "off"
    const eligibleRouteTypes = await RouteType.find(
        { routeStatus: { $nin: ["off", "Off", "OFF"] }, isActive: { $ne: false } },
        { _id: 1 }
    ).lean() as any[];
    const eligibleTypeIds = eligibleRouteTypes.map((rt: any) => String(rt._id));

    const allRoutes = await SYMXRoute.find(
        {
            yearWeek,
            van: { $in: ["", null] },
            typeId: { $in: eligibleTypeIds },
        },
        { _id: 1, transporterId: 1, date: 1, routeSize: 1, typeId: 1, van: 1 }
    ).lean() as any[];

    if (allRoutes.length === 0) {
        console.log("[Auto Van Assignment] No routes need van assignment");
        return;
    }

    // 2. Get unique transporter IDs and fetch employee data
    const transporterIds = [...new Set(allRoutes.map(r => r.transporterId))];
    const employees = await SymxEmployee.find(
        { transporterId: { $in: transporterIds } },
        { transporterId: 1, hiredDate: 1 }
    ).lean() as any[];

    const empMap = new Map<string, { hiredDate: Date | null }>();
    for (const emp of employees) {
        empMap.set(emp.transporterId, { hiredDate: emp.hiredDate || null });
    }

    // 3. Get all vans already assigned this week (to exclude them)
    const assignedVans = await SYMXRoute.distinct("van", {
        yearWeek,
        van: { $nin: ["", null] },
    }) as string[];
    const assignedVanSet = new Set(assignedVans);

    // 4. Fetch all Active vehicles
    const activeVehicles = await Vehicle.find(
        { status: "Active", serviceType: { $in: SIZE_CATEGORIES } },
        { vehicleName: 1, serviceType: 1, dashcam: 1 }
    ).sort({ vehicleName: -1 }).lean() as any[];

    let totalAssigned = 0;

    for (const sizeCategory of SIZE_CATEGORIES) {
        // ── Routes for this size category ──
        const sizeRoutes = allRoutes.filter(
            r => (r.routeSize || "").toLowerCase() === sizeCategory.toLowerCase()
        );

        if (sizeRoutes.length === 0) continue;

        // ── Split into untrained (new) vs trained (experienced) ──
        const untrained: any[] = [];
        const trained: any[] = [];

        for (const route of sizeRoutes) {
            const emp = empMap.get(route.transporterId);
            const hiredDate = emp?.hiredDate ? new Date(emp.hiredDate) : null;

            if (hiredDate && hiredDate > NINETY_DAYS_AGO) {
                untrained.push({ ...route, hiredDate });
            } else {
                trained.push({ ...route, hiredDate: hiredDate || new Date(0) });
            }
        }

        // Sort both by hiredDate ascending (most senior first)
        untrained.sort((a, b) => a.hiredDate.getTime() - b.hiredDate.getTime());
        trained.sort((a, b) => a.hiredDate.getTime() - b.hiredDate.getTime());

        // ── Available vans for this size (not already assigned in this week) ──
        const availableVans = activeVehicles
            .filter(v =>
                (v.serviceType || "").toLowerCase() === sizeCategory.toLowerCase() &&
                !assignedVanSet.has(v.vehicleName)
            );

        if (availableVans.length === 0) {
            console.log(`[Auto Van Assignment] No available ${sizeCategory} vans`);
            continue;
        }

        // ── Assign: untrained first, then trained ──
        const orderedRoutes = [...untrained, ...trained];
        const vanQueue = [...availableVans]; // work with a copy

        const vanUpdates: { routeId: string; vehicleName: string; serviceType: string; dashcam: string }[] = [];

        for (const route of orderedRoutes) {
            if (vanQueue.length === 0) break;

            const van = vanQueue.shift()!;
            vanUpdates.push({
                routeId: route._id.toString(),
                vehicleName: van.vehicleName,
                serviceType: van.serviceType || "",
                dashcam: van.dashcam || "",
            });

            // Mark this van as assigned so it's not used again for other days
            assignedVanSet.add(van.vehicleName);
        }

        // ── Bulk update routes with assigned vans ──
        if (vanUpdates.length > 0) {
            const updateOps = vanUpdates.map(u => ({
                updateOne: {
                    filter: { _id: u.routeId },
                    update: {
                        $set: {
                            van: u.vehicleName,
                            serviceType: u.serviceType,
                            dashcam: u.dashcam,
                        },
                    },
                },
            }));

            await SYMXRoute.bulkWrite(updateOps, { ordered: false });
            totalAssigned += vanUpdates.length;

            console.log(`[Auto Van Assignment] Assigned ${vanUpdates.length} ${sizeCategory} vans`);
        }
    }

    // ── Also try to assign vans to routes with NO routeSize (fallback) ──
    // Routes where routeSize is empty — try to match by any remaining available van
    const noSizeRoutes = allRoutes.filter(r => !r.routeSize || r.routeSize.trim() === "");
    if (noSizeRoutes.length > 0) {
        // Get remaining unassigned vehicles
        const remainingVans = activeVehicles.filter(v => !assignedVanSet.has(v.vehicleName));

        if (remainingVans.length > 0) {
            // Sort by hiredDate
            const sortedRoutes = noSizeRoutes.map(r => {
                const emp = empMap.get(r.transporterId);
                return { ...r, hiredDate: emp?.hiredDate ? new Date(emp.hiredDate) : new Date(0) };
            }).sort((a, b) => a.hiredDate.getTime() - b.hiredDate.getTime());

            const vanQueue = [...remainingVans];
            const updateOps: any[] = [];

            for (const route of sortedRoutes) {
                if (vanQueue.length === 0) break;
                const van = vanQueue.shift()!;
                updateOps.push({
                    updateOne: {
                        filter: { _id: route._id },
                        update: {
                            $set: {
                                van: van.vehicleName,
                                serviceType: van.serviceType || "",
                                dashcam: van.dashcam || "",
                            },
                        },
                    },
                });
                assignedVanSet.add(van.vehicleName);
            }

            if (updateOps.length > 0) {
                await SYMXRoute.bulkWrite(updateOps, { ordered: false });
                totalAssigned += updateOps.length;
                console.log(`[Auto Van Assignment] Assigned ${updateOps.length} vans to routes with no size category`);
            }
        }
    }

    console.log(`[Auto Van Assignment] Total assigned: ${totalAssigned} vans across ${SIZE_CATEGORIES.join(", ")}`);
}

// PUT: Update a single route record (+ sync type back to schedule + audit log)
export async function PUT(req: NextRequest) {
  try {
    await requirePermission("Dispatching", "edit");
  } catch (e: any) {
    if (e.name === "ForbiddenError") {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

    try {
        const rawBody = await req.json();
        console.log(`[PUT /api/dispatching/routes] Received PUT request`, rawBody);
        
        const validation = validateBody(updateRouteSchema, rawBody);
        if (!validation.success) {
            return validation.response;
        }

        const auth = await authorizeAction("Dispatching", "edit");
        if (!auth.authorized) return auth.response;
        
        const session = auth.session;

        const { routeId, updates } = validation.data;

        await connectToDatabase();

        // Fetch existing route BEFORE updating (for audit old values)
        const existing = await SYMXRoute.findById(routeId).lean() as any;
        if (!existing) {
            console.error(`[PUT /api/dispatching/routes] Route not found for ID: ${routeId}`);
            return NextResponse.json({ error: "Route not found" }, { status: 404 });
        }

        // If van is being updated, auto-resolve serviceType + dashcam from Vehicle
        if (updates.van !== undefined && updates.van.trim() !== "") {
            try {
                const vehicle = await Vehicle.findOne(
                    { vehicleName: updates.van.trim() },
                    { serviceType: 1, dashcam: 1 }
                ).lean() as any;
                if (vehicle) {
                    updates.serviceType = vehicle.serviceType || "";
                    updates.dashcam = vehicle.dashcam || "";
                }
            } catch { }
        } else if (updates.van !== undefined && updates.van.trim() === "") {
            // Clearing van also clears serviceType + dashcam
            updates.serviceType = "";
            updates.dashcam = "";
        }

        // Update route record directly (no session — Atlas free tier has write conflict issues with transactions)
        const updated = await SYMXRoute.findByIdAndUpdate(
            routeId,
            { $set: updates },
            { new: true, lean: true }
        ) as any;

        // If typeId was changed, sync it back to SYMXEmployeeSchedule + audit log
        if (updates.typeId !== undefined && existing.typeId !== updates.typeId) {
            const newTypeId = (updates.typeId || "").trim();

            // Resolve routeStatus from RouteType for the schedule sync
            let newRouteStatus = "Scheduled";
            if (!newTypeId) {
                newRouteStatus = "Off";
            } else {
                try {
                    const rt = await RouteType.findById(newTypeId, { routeStatus: 1 }).lean() as any;
                    if (rt?.routeStatus) newRouteStatus = rt.routeStatus;
                } catch { }
            }

            // Sync typeId → SYMXEmployeeSchedule via native collection (bypass strict mode)
            if (existing.scheduleId) {
                const schedulesCol = mongoose.connection.db!.collection("SYMXEmployeeSchedules");
                await schedulesCol.updateOne(
                    { _id: new mongoose.Types.ObjectId(String(existing.scheduleId)) },
                    { $set: { typeId: newTypeId, routeStatus: newRouteStatus } }
                );
            }

            // Also ensure typeId is persisted on the route via native collection
            const routesCol = mongoose.connection.db!.collection("SYMXRoutes");
            await routesCol.updateOne(
                { _id: new mongoose.Types.ObjectId(routeId) },
                { $set: { typeId: newTypeId } }
            );

            // Resolve performer name and employee name for audit
            const performer = await resolvePerformerName(session);
            let employeeName = "";
            try {
                const emp = await SymxEmployee.findOne(
                    { transporterId: existing.transporterId },
                    { firstName: 1, lastName: 1 }
                ).lean() as any;
                if (emp) employeeName = `${emp.firstName} ${emp.lastName}`.toUpperCase();
            } catch { }

            const dateObj = existing.date ? new Date(existing.date) : null;
            const dayName = dateObj ? FULL_DAY_NAMES[dateObj.getUTCDay()] : "";

            await ScheduleAuditLog.create([{
                yearWeek: existing.yearWeek || "",
                transporterId: existing.transporterId,
                employeeName,
                action: "type_changed",
                field: "typeId",
                oldValue: existing.typeId || "",
                newValue: newTypeId,
                date: existing.date,
                dayOfWeek: dayName,
                performedBy: performer.email,
                performedByName: performer.name,
            }]);
        }

        return NextResponse.json({ route: updated });
    } catch (error: any) {
        console.error("Error updating route:", error);
        return NextResponse.json({ error: error.message || "Failed to update route" }, { status: 500 });
    }
}
