import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getRequestScope, siteFilter, findScopedById, resolveWriteSiteId, orgWide} from "@/lib/scoped-query";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxEmployee from "@/lib/models/SymxEmployee";
import ScheduleAuditLog from "@/lib/models/ScheduleAuditLog";
import SYMXSetting from "@/lib/models/SYMXSetting";
import SymxUser from "@/lib/models/SymxUser";
import Vehicle from "@/lib/models/Vehicle";
import DailyInspection from "@/lib/models/DailyInspection";
import RouteType from "@/lib/models/RouteType";
import { z } from "zod";
import { validateBody, validateSearchParams } from "@/lib/validations";
import { authorizeAction } from "@/lib/rbac";
import { canViewCompensation } from "@/lib/compensation-visibility";
import { generateRoutesForWeek } from "@/lib/route-generation";

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

// The 8 fields the Cortex extension sync can auto-fill (deliveryCompletionTime
// stays manual). Kept in sync with AUTO_FIELDS in app/api/public/cortex-sync/route.ts.
const CORTEX_AUTO_FIELDS = new Set([
    "actualDepartureTime",
    "plannedOutboundStem",
    "actualOutboundStem",
    "plannedFirstStop",
    "actualFirstStop",
    "plannedLastStop",
    "actualLastStop",
    "stopsRescued",
]);

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
  let dispatchingSession;
  try {
    dispatchingSession = await requirePermission("Dispatching", "view");
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
            const probeScope = await getRequestScope();
            const count = await SYMXRoute.countDocuments({
                yearWeek,
                ...siteFilter(probeScope, { includeUnassigned: true }),
            });
            return NextResponse.json({ routesGenerated: count > 0 });
        }

        // Fetch RouteType metadata — filter to only those with "Dispatching" in partOf
        const scope = await getRequestScope();
        const S = siteFilter(scope, { includeUnassigned: true });

        // Route types are per-station: start times differ by station, so
        // each one keeps its own set rather than sharing a catalogue.
        const allRouteTypes = await RouteType.find(
            { ...S },
            { _id: 1, name: 1, routeStatus: 1, partOf: 1 }
        ).lean() as any[];
        const rtNameToId = new Map<string, string>();   // name.lower → typeId string

        // Include all types except those whose name is literally "Off"
        const dispatchingTypeIds: string[] = [];
        const offTypeIds: string[] = [];

        for (const rt of allRouteTypes) {
            const id = String(rt._id);
            rtNameToId.set((rt.name || "").trim().toLowerCase(), id);
            const nameNorm = (rt.name || "").trim().toLowerCase();
            const isOff = nameNorm === "off";

            if (!isOff) {
                dispatchingTypeIds.push(id);
            } else {
                offTypeIds.push(id);
            }
        }

        // Build query — only show routes whose typeId is a Dispatching-partOf, non-Off RouteType
        // Match both string AND ObjectId stored values (handles pre-migration records)
        const query: any = { yearWeek, ...S };
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
            SYMXSetting.findOne({ key: "routes_completion_types", ...S }).lean(),
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
        const allVanNames = [...new Set(routes.map((r: any) => r.van).filter(Boolean))];

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
            orgWide(
                SymxEmployee.find(
                    { transporterId: { $in: transporterIds } },
                    { transporterId: 1, firstName: 1, lastName: 1, phoneNumber: 1, type: 1, status: 1, profileImage: 1, routesComp: 1, rate: 1, hiredDate: 1 }
                ),
                "resolving driver details for routes already scoped to this station — a driver loaned in from another station must still show a name and phone number, not a blank row"
            ).lean(),
            SYMXRoute.aggregate([
                { $match: { ...routeCountMatch, ...S } },
                { $group: { _id: { transporterId: "$transporterId", date: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: BUSINESS_TZ } } }, count: { $sum: 1 } } },
            ]),
            ScheduleAuditLog.aggregate([
                { $match: { yearWeek, ...S } },
                { $group: { _id: "$transporterId", count: { $sum: 1 } } },
            ]),
            allVanNames.length > 0
                ? orgWide(
                    Vehicle.find({ vehicleName: { $in: allVanNames } }, { vin: 1, vehicleName: 1 }),
                    "resolving names/vans for records already scoped to this station — a driver or van loaned in from elsewhere must still display, not appear blank"
                  ).lean()
                : [],
            // Fetch schedules linked to these routes (for shiftNotification status)
            (() => {
                const scheduleIds = routes
                    .map((r: any) => r.scheduleId)
                    .filter(Boolean)
                    .map((id: string) => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } })
                    .filter(Boolean);

                if (scheduleIds.length === 0) return Promise.resolve([]);
                // Ids come from routes already filtered to this station,
                // so this is a by-id fetch of records we just authorised.
                return SymxEmployeeSchedule.find(
                    { _id: { $in: scheduleIds } },
                    { transporterId: 1, date: 1, shiftNotification: 1 }
                ).lean();
            })()
        ]);

        // Pay rate is only visible to Super Admin / Owner-module-level
        // access — see lib/compensation-visibility.ts. This route embeds
        // rate into the employees map purely for internal cost display; it
        // has nothing to do with Dispatching permission, so it needs its
        // own gate rather than riding along with view access to this route.
        const canViewComp = await canViewCompensation(dispatchingSession);

        // ── Build maps (all O(n), very fast) ──
        const employeeMap: Record<string, any> = {};
        const initialCompMap: Record<string, number> = {};
        const activeTransporterIds = new Set<string>();
        employees.forEach((emp: any) => {
            const normalizedTid = (emp.transporterId || "").trim().toUpperCase();
            employeeMap[normalizedTid] = {
                name: `${emp.firstName} ${emp.lastName}`.toUpperCase(),
                firstName: emp.firstName,
                lastName: emp.lastName,
                phoneNumber: emp.phoneNumber || "",
                type: emp.type || "",
                profileImage: emp.profileImage || "",
                ...(canViewComp ? { rate: emp.rate || 0 } : {}),
                hiredDate: emp.hiredDate || null,
            };
            initialCompMap[normalizedTid] = parseInt(emp.routesComp) || 0;
            if ((emp.status || "").toLowerCase() === "active") {
                activeTransporterIds.add(normalizedTid);
            }
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
        const vehicleNameToVin: Record<string, string> = {};
        (vehicleDocs as any[]).forEach((v: any) => {
            if (v.vin && v.vehicleName) {
                vehicleNames[v.vin] = v.vehicleName;
                vehicleNameToVin[v.vehicleName] = v.vin;
            }
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
                createdBy: entry.createdBy || "",
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
        // ── Enrich routes with resolved type name from typeId ──
        const rtIdToName = new Map<string, string>();
        for (const rt of allRouteTypes) {
            rtIdToName.set(String(rt._id), rt.name || "");
        }

        // ── Enrich routes with vin resolved from vehicleName → vin map ──
        const backfillVinOps: any[] = [];
        const enrichedRoutes = routes
            .filter((r: any) => {
                const tid = (r.transporterId || "").trim().toUpperCase();
                return activeTransporterIds.has(tid);
            })
            .map((r: any) => {
            const typeId = r.typeId ? String(r.typeId) : "";
            const resolvedType = typeId ? (rtIdToName.get(typeId) || r.type || "") : (r.type || "");
            const emp = employeeMap[(r.transporterId || "").trim().toUpperCase()] || {};
            // Resolve vin from the van (vehicleName) field
            const resolvedVin = r.van ? (vehicleNameToVin[r.van] || r.vin || "") : (r.vin || "");
            // Queue lazy backfill if vin is missing or stale in the DB (only for W19+)
            if (resolvedVin && r.vin !== resolvedVin && (r.yearWeek || "") >= "2026-W19") {
                backfillVinOps.push({
                    updateOne: {
                        filter: { _id: r._id },
                        update: { $set: { vin: resolvedVin } },
                    },
                });
            }
            return {
                ...r,
                type: resolvedType,
                vin: resolvedVin,
                employeeName: emp.name || r.transporterId,
                profileImage: emp.profileImage || "",
                phone: emp.phoneNumber || "",
            };
        });

        // Fire-and-forget lazy backfill of vin onto routes
        if (backfillVinOps.length > 0) {
            SYMXRoute.bulkWrite(backfillVinOps, { ordered: false }).catch(() => {});
        }

        // ── DailyInspection enrichment (authoritative source of truth) ──
        const routeIds = enrichedRoutes.map((r: any) => String(r._id));
        const dailyInspections = routeIds.length > 0
          ? await DailyInspection.find(
              { routeId: { $in: routeIds }, ...S },
              { _id: 1, routeId: 1, timeStamp: 1, mileage: 1 }
            )
              .sort({ timeStamp: -1 })
              .lean()
          : [];

        // First encounter per routeId wins (most recent, sorted desc)
        const inspByRouteId = new Map<string, { _id: any; timeStamp: any; mileage: any }>();
        for (const insp of dailyInspections as any[]) {
          const rid = String(insp.routeId);
          if (!inspByRouteId.has(rid)) inspByRouteId.set(rid, insp);
        }

        // Override inspectionId/inspectionTime from DailyInspection when present
        const inspectionBackfillOps: any[] = [];
        for (const r of enrichedRoutes as any[]) {
          const insp = inspByRouteId.get(String(r._id));
          if (insp) {
            const newInspId = String(insp._id);
            const newInspTime = new Date(insp.timeStamp).toLocaleTimeString("en-US", {
              hour12: false, hour: "2-digit", minute: "2-digit", timeZone: BUSINESS_TZ,
            });
            // Back-fill stale SYMXRoute if needed (fire-and-forget)
            if (r.inspectionId !== newInspId) {
              inspectionBackfillOps.push({
                updateOne: {
                  filter: { _id: r._id },
                  update: { $set: { inspectionId: newInspId, inspectionTime: newInspTime } },
                },
              });
            }
            r.inspectionId = newInspId;
            r.inspectionTime = newInspTime;
          }
        }
        if (inspectionBackfillOps.length > 0) {
          SYMXRoute.bulkWrite(inspectionBackfillOps, { ordered: false }).catch(() => {});
        }

        return NextResponse.json({
            routes: enrichedRoutes,
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

        const genScope = await getRequestScope();
        const genSiteId = resolveWriteSiteId(genScope, null);
        if (!genSiteId) {
            return NextResponse.json(
                { error: "Select a single station before generating routes." },
                { status: 400 }
            );
        }
        const result = await generateRoutesForWeek(yearWeek, genSiteId, regenerate);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Error generating routes:", error);
        if (error.message === "No schedules found for this week") {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        return NextResponse.json({ error: error.message || "Failed to generate routes" }, { status: 500 });
    }
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
        const putScope = await getRequestScope();
        const existing = await findScopedById<any>(SYMXRoute, routeId, putScope) as any;
        if (!existing) {
            console.error(`[PUT /api/dispatching/routes] Route not found for ID: ${routeId}`);
            return NextResponse.json({ error: "Route not found" }, { status: 404 });
        }

        // A dispatcher directly editing one of the Cortex-syncable fields
        // means this value is now theirs: stop treating it as safe for the
        // Cortex sync to silently auto-update, and clear any stale conflict
        // banner for that field (the manual edit supersedes it).
        const cortexTouchedFields = Object.keys(updates).filter((f) => CORTEX_AUTO_FIELDS.has(f));
        if (cortexTouchedFields.length > 0) {
            const remainingOwned = (Array.isArray(existing.cortexSyncedFields) ? existing.cortexSyncedFields : [])
                .filter((f: string) => !cortexTouchedFields.includes(f));
            const remainingConflicts = (Array.isArray(existing.cortexConflicts) ? existing.cortexConflicts : [])
                .filter((c: any) => !cortexTouchedFields.includes(c.field));
            updates.cortexSyncedFields = remainingOwned;
            updates.cortexConflicts = remainingConflicts;
        }

        // If van is being updated, auto-resolve serviceType + dashcam + vin from Vehicle
        if (updates.van !== undefined && updates.van.trim() !== "") {
            try {
                const vehicle = await Vehicle.findOne(
                    { vehicleName: updates.van.trim() },
                    { vin: 1, serviceType: 1, dashcam: 1 }
                ).lean() as any;
                if (vehicle) {
                    updates.vin = vehicle.vin || "";
                    updates.serviceType = vehicle.serviceType || "";
                    updates.dashcam = vehicle.dashcam || "";
                }
            } catch { }
        } else if (updates.van !== undefined && updates.van.trim() === "") {
            // Clearing van also clears serviceType + dashcam + vin
            updates.vin = "";
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
                    // Route type must belong to a station the caller can
                    // reach, or a route could be retyped using another
                    // station's configuration.
                    if (rt && !putScope.allowedSiteIds.includes(String((rt as any).siteId || putScope.defaultSiteId))) {
                        return NextResponse.json({ error: "Unknown route type" }, { status: 400 });
                    }
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
