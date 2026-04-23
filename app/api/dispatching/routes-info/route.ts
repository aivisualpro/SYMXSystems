import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SYMXRoutesInfo from "@/lib/models/SYMXRoutesInfo";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEmployee from "@/lib/models/SymxEmployee";
import DropdownOption from "@/lib/models/DropdownOption";
import SYMXWSTOption from "@/lib/models/SYMXWSTOption";

const TOTAL_ROWS = 100;

// Helper: build empty row for a given date + rowIndex
function emptyRow(date: string, rowIndex: number) {
    return {
        _id: null,
        date,
        rowIndex,
        routeNumber: "",
        stopCount: "",
        packageCount: "",
        routeDuration: "",
        waveTime: "",
        pad: "",
        wst: "",
        wstDuration: "",
        bags: "",
        ov: "",
        stagingLocation: "",
        transporterId: "",
    };
}

// GET: Fetch all 100 rows for a date + drivers from SYMXRoutes for date + wave time options
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
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const date = searchParams.get("date");
        if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });

        await connectToDatabase();

        const dateObj = new Date(date);

        // Fetch saved rows, route-based drivers, dropdown options in parallel
        const [saved, routeDrivers, waveTimeOpts, padOpts, wstOpts] = await Promise.all([
            // 1. Saved RoutesInfo rows for the date
            SYMXRoutesInfo.find({ date: dateObj })
                .sort({ rowIndex: 1 })
                .lean(),

            // 2. Drivers from SYMXRoutes for this date (only drivers that have a route on this day)
            SYMXRoute.find(
                { date: dateObj, transporterId: { $exists: true, $ne: "" } },
                { transporterId: 1 }
            ).lean(),

            // 3. Wave time dropdown options
            DropdownOption.find(
                { type: "wave time", isActive: true },
            )
                .sort({ sortOrder: 1, description: 1 })
                .lean(),

            // 4. PAD dropdown options
            DropdownOption.find(
                { type: "pad", isActive: true },
            )
                .sort({ sortOrder: 1, description: 1 })
                .lean(),

            // 5. WST options
            SYMXWSTOption.find({ isActive: true })
                .sort({ sortOrder: 1, wst: 1 })
                .lean(),
        ]);

        // Get unique transporter IDs from routes on this date
        const transporterIds = [...new Set(routeDrivers.map((r: any) => r.transporterId))];
        const validTransporterSet = new Set(transporterIds);

        // Build a map of saved rows by rowIndex
        const savedMap: Record<number, any> = {};
        saved.forEach((r: any) => {
            const rawTid = (r.transporterId || "").trim();
            // Clear transporterId if this driver is no longer scheduled on this day
            const validTid = validTransporterSet.has(rawTid) ? rawTid : "";

            savedMap[r.rowIndex] = {
                _id: r._id.toString(),
                date: r.date,
                rowIndex: r.rowIndex,
                routeNumber: r.routeNumber || "",
                stopCount: r.stopCount || "",
                packageCount: r.packageCount || "",
                routeDuration: r.routeDuration || "",
                waveTime: r.waveTime || "",
                pad: r.pad || "",
                wst: r.wst || "",
                wstDuration: r.wstDuration || "",
                bags: r.bags || "",
                ov: r.ov || "",
                stagingLocation: r.stagingLocation || "",
                transporterId: validTid,
                rawSummary: r.rawSummary || null,
            };
        });

        // Build 100-row array, merging saved data
        const rows = [];
        for (let i = 0; i < TOTAL_ROWS; i++) {
            rows.push(savedMap[i] || emptyRow(date, i));
        }

        // Enrich with employee names
        let drivers: { transporterId: string; name: string }[] = [];
        if (transporterIds.length > 0) {
            const employees = await SymxEmployee.find(
                { transporterId: { $in: transporterIds } },
                { transporterId: 1, firstName: 1, lastName: 1 }
            ).lean();

            const empMap = new Map<string, string>();
            employees.forEach((e: any) => {
                empMap.set(e.transporterId, `${e.firstName} ${e.lastName}`.trim());
            });

            drivers = transporterIds.map(tid => ({
                transporterId: tid,
                name: empMap.get(tid) || tid,
            }));
            drivers.sort((a, b) => a.name.localeCompare(b.name));
        }

        // Dropdown options
        const waveTimeOptions = waveTimeOpts.map((o: any) => o.description);
        const padOptions = padOpts.map((o: any) => o.description);
        const wstOptions = wstOpts.map((o: any) => ({ wst: o.wst, revenue: o.revenue }));

        return NextResponse.json({ rows, employees: drivers, waveTimeOptions, padOptions, wstOptions });
    } catch (error: any) {
        console.error("Error fetching routes info:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch" }, { status: 500 });
    }
}

// POST: Bulk upsert rows — saves all changed rows in one call
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
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { date, rows } = body;

        if (!date || !rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: "date and rows[] are required" }, { status: 400 });
        }

        await connectToDatabase();

        const dateObj = new Date(date);

        // ── Fetch existing RoutesInfo rows BEFORE saving, to detect driver replacements ──
        const changedRowIndices = rows.map((r: any) => r.rowIndex);
        const existingRows = await SYMXRoutesInfo.find(
            { date: dateObj, rowIndex: { $in: changedRowIndices } },
            { rowIndex: 1, transporterId: 1 }
        ).lean() as any[];

        const oldTransporterMap = new Map<number, string>();
        existingRows.forEach((r: any) => {
            if (r.transporterId && r.transporterId.trim() !== "") {
                oldTransporterMap.set(r.rowIndex, r.transporterId);
            }
        });

        // ── Upsert rows ──
        const ops = rows.map((row: any) => ({
            updateOne: {
                filter: { date: dateObj, rowIndex: row.rowIndex },
                update: {
                    $set: {
                        date: dateObj,
                        rowIndex: row.rowIndex,
                        routeNumber: row.routeNumber || "",
                        stopCount: row.stopCount || "",
                        packageCount: row.packageCount || "",
                        routeDuration: row.routeDuration || "",
                        waveTime: row.waveTime || "",
                        pad: row.pad || "",
                        wst: row.wst || "",
                        wstDuration: row.wstDuration || "",
                        bags: row.bags || "",
                        ov: row.ov || "",
                        stagingLocation: row.stagingLocation || "",
                        transporterId: row.transporterId || "",
                    },
                },
                upsert: true,
            },
        }));

        if (ops.length > 0) {
            await SYMXRoutesInfo.bulkWrite(ops, { ordered: false });
        }

        // ── Detect replaced drivers and clear their route info ──
        // Build a set of new transporterIds from all rows for this date
        // (will be used to check if old driver is still referenced by another row)
        const newTransporterIdsByRow = new Map<number, string>();
        rows.forEach((r: any) => {
            newTransporterIdsByRow.set(r.rowIndex, (r.transporterId || "").trim());
        });

        const driversToClean = new Set<string>();
        for (const [rowIndex, oldTid] of oldTransporterMap) {
            const newTid = newTransporterIdsByRow.get(rowIndex) || "";
            if (oldTid !== newTid) {
                driversToClean.add(oldTid);
            }
        }

        // Clear route info from replaced drivers (only if no other RoutesInfo row still points to them)
        if (driversToClean.size > 0) {
            try {
                for (const oldTid of driversToClean) {
                    const otherRow = await SYMXRoutesInfo.findOne({
                        date: dateObj,
                        transporterId: oldTid,
                    }).lean();

                    if (!otherRow) {
                        await SYMXRoute.updateOne(
                            { transporterId: oldTid, date: dateObj },
                            { $set: blankRouteInfoForRoute() }
                        );
                        console.log(`[RoutesInfo POST] Cleared route info from replaced driver ${oldTid}`);
                    }
                }
            } catch (e) {
                console.error("Error clearing replaced drivers' route info:", e);
            }
        }

        // ── Sync route info to current drivers ──
        const rowsWithTransporter = rows.filter((r: any) => r.transporterId && r.transporterId.trim() !== "");
        if (rowsWithTransporter.length > 0) {
            const routeOps = rowsWithTransporter.map((row: any) => ({
                updateOne: {
                    filter: { transporterId: row.transporterId, date: dateObj },
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
            try {
                await SYMXRoute.bulkWrite(routeOps, { ordered: false });
            } catch (e) {
                console.error("Error syncing to SYMXRoutes:", e);
            }
        }

        return NextResponse.json({ ok: true, saved: ops.length, synced: rowsWithTransporter.length, cleared: driversToClean.size });
    } catch (error: any) {
        console.error("Error saving routes info:", error);
        return NextResponse.json({ error: error.message || "Failed to save" }, { status: 500 });
    }
}

// The route info fields that sync from RoutesInfo → SYMXRoute
const ROUTE_INFO_FIELDS = ["routeNumber", "stopCount", "packageCount", "routeDuration", "waveTime", "pad", "wst", "wstDuration", "bags", "ov", "stagingLocation"];

// Build a blank set of route info fields (to clear from old driver)
function blankRouteInfoForRoute(): Record<string, any> {
    return {
        routeNumber: "",
        stopCount: 0,
        packageCount: 0,
        routeDuration: "",
        waveTime: "",
        pad: "",
        wst: "",
        wstDuration: 0,
        bags: "",
        ov: "",
        stagingLocation: "",
    };
}

// Build a sync payload from a RoutesInfo row → SYMXRoute format
function buildRouteSyncFields(row: any): Record<string, any> {
    const fields: Record<string, any> = {};
    ROUTE_INFO_FIELDS.forEach(f => {
        const val = row[f] || "";
        fields[f] = (f === "stopCount" || f === "packageCount" || f === "wstDuration")
            ? parseInt(val) || 0
            : val;
    });
    return fields;
}

// PUT: Update a single cell/row instantly (for real-time cell editing)
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
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { date, rowIndex, field, value } = body;

        if (!date || rowIndex === undefined || !field) {
            return NextResponse.json({ error: "date, rowIndex, and field are required" }, { status: 400 });
        }

        await connectToDatabase();

        const dateObj = new Date(date);

        // ── If the driver is being changed, capture the OLD transporterId first ──
        let oldTransporterId: string | null = null;
        if (field === "transporterId") {
            const existingRow = await SYMXRoutesInfo.findOne(
                { date: dateObj, rowIndex },
                { transporterId: 1 }
            ).lean() as any;
            oldTransporterId = existingRow?.transporterId || null;
        }

        // Upsert the specific field
        const result = await SYMXRoutesInfo.findOneAndUpdate(
            { date: dateObj, rowIndex },
            { $set: { [field]: value || "", date: dateObj, rowIndex } },
            { upsert: true, new: true, lean: true }
        );

        const row = result as any;

        // ══════════════════════════════════════════════════════════════════
        // ── DRIVER REPLACEMENT LOGIC ──
        // When the transporterId changes on a RoutesInfo row:
        //   1. CLEAR route info fields from the OLD driver's SYMXRoute
        //   2. APPLY route info fields to the NEW driver's SYMXRoute
        // This ensures the route data follows the driver assignment.
        // ══════════════════════════════════════════════════════════════════
        if (field === "transporterId") {
            const newTransporterId = (value || "").trim();

            // 1. Clear route info from OLD driver's SYMXRoute
            if (oldTransporterId && oldTransporterId.trim() !== "" && oldTransporterId !== newTransporterId) {
                try {
                    // Check if any OTHER RoutesInfo row still points to this old driver on the same date.
                    // If so, don't clear — another row still owns those fields.
                    const otherRowWithOldDriver = await SYMXRoutesInfo.findOne({
                        date: dateObj,
                        transporterId: oldTransporterId,
                        rowIndex: { $ne: rowIndex },
                    }).lean();

                    if (!otherRowWithOldDriver) {
                        await SYMXRoute.updateOne(
                            { transporterId: oldTransporterId, date: dateObj },
                            { $set: blankRouteInfoForRoute() }
                        );
                        console.log(`[RoutesInfo PUT] Cleared route info from old driver ${oldTransporterId}`);
                    }
                } catch (e) {
                    console.error("Error clearing old driver's route info:", e);
                }
            }

            // 2. Apply all route info fields to NEW driver's SYMXRoute
            if (newTransporterId) {
                try {
                    const syncFields = buildRouteSyncFields(row);
                    await SYMXRoute.updateOne(
                        { transporterId: newTransporterId, date: dateObj },
                        { $set: syncFields }
                    );
                    console.log(`[RoutesInfo PUT] Applied route info to new driver ${newTransporterId}`);
                } catch (e) {
                    console.error("Error syncing route info to new driver:", e);
                }
            }

            return NextResponse.json({ ok: true });
        }

        // ── NON-DRIVER FIELD — sync to SYMXRoute if a driver is linked ──
        if (row?.transporterId && row.transporterId.trim() !== "") {
            if (ROUTE_INFO_FIELDS.includes(field)) {
                const syncValue = (field === "stopCount" || field === "packageCount" || field === "wstDuration")
                    ? parseInt(value) || 0
                    : value || "";
                try {
                    await SYMXRoute.updateOne(
                        { transporterId: row.transporterId, date: dateObj },
                        { $set: { [field]: syncValue } }
                    );
                } catch (e) {
                    console.error("Error syncing cell to SYMXRoute:", e);
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error("Error updating routes info cell:", error);
        return NextResponse.json({ error: error.message || "Failed to update" }, { status: 500 });
    }
}

// DELETE: Remove a single RoutesInfo row and clear route info from the driver's SYMXRoute
export async function DELETE(req: NextRequest) {
    try {
        await requirePermission("Dispatching", "edit");
    } catch (e: any) {
        if (e.name === "ForbiddenError") {
            return NextResponse.json({ error: e.message }, { status: 403 });
        }
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const date = searchParams.get("date");
        const rowIndexRaw = searchParams.get("rowIndex");

        if (!date || rowIndexRaw === null) {
            return NextResponse.json({ error: "date and rowIndex are required" }, { status: 400 });
        }

        const rowIndex = parseInt(rowIndexRaw, 10);
        await connectToDatabase();
        const dateObj = new Date(date);

        // Fetch the row before deleting to know if we need to clear a driver's route info
        const existingRow = await SYMXRoutesInfo.findOne({ date: dateObj, rowIndex }).lean() as any;

        if (existingRow) {
            await SYMXRoutesInfo.deleteOne({ _id: existingRow._id });

            // If it had a driver, check if they still have another row, otherwise clear their SYMXRoute fields
            if (existingRow.transporterId && existingRow.transporterId.trim() !== "") {
                const oldTid = existingRow.transporterId;
                const otherRow = await SYMXRoutesInfo.findOne({
                    date: dateObj,
                    transporterId: oldTid,
                }).lean();

                if (!otherRow) {
                    await SYMXRoute.updateOne(
                        { transporterId: oldTid, date: dateObj },
                        { $set: blankRouteInfoForRoute() }
                    );
                    console.log(`[RoutesInfo DELETE] Cleared route info from driver ${oldTid}`);
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error("Error deleting routes info row:", error);
        return NextResponse.json({ error: error.message || "Failed to delete" }, { status: 500 });
    }
}

