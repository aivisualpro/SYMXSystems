import mongoose from "mongoose";
import connectToDatabase from "@/lib/db";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SYMXRoutesInfo from "@/lib/models/SYMXRoutesInfo";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxEmployee from "@/lib/models/SymxEmployee";
import Vehicle from "@/lib/models/Vehicle";
import RouteType from "@/lib/models/RouteType";

export interface GenerateRoutesResult {
    message: string;
    count: number;
    created: number;
}

/**
 * Generate (or safely regenerate) route records for a yearWeek from that
 * week's SymxEmployeeSchedule — shared by the authenticated "Generate
 * Routes" button in Dispatching and the Friday-night cron job.
 *
 * Regeneration is a safe upsert: only schedule-level fields (scheduleId,
 * weekDay, typeId) are $set; everything a dispatcher already entered by
 * hand (time data, attendance, route info) is left alone, and brand-new
 * routes get blank defaults via $setOnInsert. Nothing is ever deleted.
 */
/**
 * Generate routes for one week AT ONE STATION.
 *
 * siteId is required rather than optional. This runs from a request
 * handler and from an unauthenticated cron job, and an optional
 * parameter would let the cron path silently generate across every
 * station's schedules at once — producing routes that belong nowhere and
 * mixing two stations' drivers into one week.
 */
export async function generateRoutesForWeek(
    yearWeek: string,
    siteId: string,
    regenerate = false
): Promise<GenerateRoutesResult> {
    if (!siteId) throw new Error("generateRoutesForWeek requires a siteId");
    await connectToDatabase();
    const S = { siteId };

    const existingCount = await SYMXRoute.countDocuments({ yearWeek, ...S });
    if (existingCount > 0 && !regenerate) {
        return {
            message: "Routes already generated for this week",
            count: existingCount,
            created: 0,
        };
    }

    if (existingCount > 0 && regenerate) {
        console.log(`[Generate Routes] Safe regeneration: updating ${existingCount} existing routes for ${yearWeek} (preserving all manual data)`);
    }

    // Fetch all schedules for this week — only fields needed for route generation
    const schedules = await SymxEmployeeSchedule.find(
        { yearWeek, ...S },
        { _id: 1, transporterId: 1, date: 1, weekDay: 1, typeId: 1, van: 1 }
    ).lean();

    console.log(`[Generate Routes] Found ${schedules.length} schedule records for ${yearWeek}`);

    if (schedules.length === 0) {
        throw new Error("No schedules found for this week");
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
        return {
            message: "No valid schedules found for this week (all entries are empty)",
            count: 0,
            created: 0,
        };
    }

    // Create/update route records — SAFE UPSERT approach
    const db = mongoose.connection.db!;
    const routesCol = db.collection("SYMXRoutes");

    const bulkOps = workingSchedules.map((s: any) => ({
        updateOne: {
            // siteId in the FILTER, not just the update: without it a driver
            // loaned to another station on the same date would collide onto
            // one route document shared by both stations.
            filter: { transporterId: s.transporterId, date: s.date, siteId },
            update: {
                $set: {
                    scheduleId: String(s._id),
                    weekDay: s.weekDay,
                    yearWeek,
                    typeId: s.typeId ? String(s.typeId) : "",
                },
                // Only set these on NEW inserts — never overwrite existing data
                $setOnInsert: {
                    siteId,
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

    // ── RE-APPLY ROUTES INFO DATA ──
    try {
        await reApplyRoutesInfo(yearWeek, workingSchedules, siteId);
    } catch (err: any) {
        console.error("[Re-Apply RoutesInfo] Error:", err.message);
    }

    // ── AUTO VAN ASSIGNMENT ──
    try {
        await autoAssignVans(yearWeek, siteId);
    } catch (err: any) {
        console.error("[Auto Van Assignment] Error:", err.message);
    }

    return {
        message: `Generated ${createdCount} route records for ${yearWeek}`,
        count: createdCount,
        created: createdCount,
    };
}

// ══════════════════════════════════════════════════════════
// RE-APPLY ROUTES INFO DATA
// ══════════════════════════════════════════════════════════
// After routes are generated/regenerated, fetch any existing
// SYMXRoutesInfo rows (from the Routes Info panel) that have
// a linked transporterId and re-apply their fields to the
// corresponding SYMXRoute records.
// ══════════════════════════════════════════════════════════
async function reApplyRoutesInfo(yearWeek: string, schedules: any[], siteId: string) {
    const S = { siteId };
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
        ...S,
    }).lean() as any[];

    if (routesInfoRows.length === 0) {
        console.log("[Re-Apply RoutesInfo] No linked RoutesInfo rows to re-apply");
        return;
    }

    // Build bulk update ops for SYMXRoute
    const updateOps = routesInfoRows.map((row: any) => ({
        updateOne: {
            filter: { transporterId: row.transporterId, date: row.date, ...S },
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
async function autoAssignVans(yearWeek: string, siteId: string) {
    const S = { siteId };
    const SIZE_CATEGORIES = ["SP XL", "SP L"];
    const NINETY_DAYS_AGO = new Date();
    NINETY_DAYS_AGO.setDate(NINETY_DAYS_AGO.getDate() - 90);

    // Resolve eligible typeIds (non-"off" route status routes with van assignment intent)
    const eligibleRouteTypes = await RouteType.find(
        { routeStatus: { $nin: ["off", "Off", "OFF"] }, isActive: { $ne: false } },
        { _id: 1 }
    ).lean() as any[];
    const eligibleTypeIds = eligibleRouteTypes.map((rt: any) => String(rt._id));

    const allRoutes = await SYMXRoute.find(
        {
            yearWeek,
            ...S,
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
    // Van assignment is per station: two stations can each use their own
    // van without colliding, so availability must be judged within one.
    const assignedVans = await SYMXRoute.distinct("van", {
        yearWeek,
        van: { $nin: ["", null] },
        ...S,
    }) as string[];
    const assignedVanSet = new Set(assignedVans);

    // 4. Fetch all Active vehicles
    // Only this station's vans are available to assign — a van parked at
    // DXC8 cannot run a DFO2 route. Vehicles use currentSiteId because they
    // transfer between stations.
    const activeVehicles = await Vehicle.find(
        { status: "Active", serviceType: { $in: SIZE_CATEGORIES }, currentSiteId: siteId },
        { vin: 1, vehicleName: 1, serviceType: 1, dashcam: 1 }
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

        const vanUpdates: { routeId: string; vin: string; vehicleName: string; serviceType: string; dashcam: string }[] = [];

        for (const route of orderedRoutes) {
            if (vanQueue.length === 0) break;

            const van = vanQueue.shift()!;
            vanUpdates.push({
                routeId: route._id.toString(),
                vin: van.vin || "",
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
                            vin: u.vin,
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
                                vin: van.vin || "",
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
