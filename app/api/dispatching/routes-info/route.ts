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

        // Build a map of saved rows by rowIndex
        const savedMap: Record<number, any> = {};
        saved.forEach((r: any) => {
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
                transporterId: r.transporterId || "",
            };
        });

        // Build 100-row array, merging saved data
        const rows = [];
        for (let i = 0; i < TOTAL_ROWS; i++) {
            rows.push(savedMap[i] || emptyRow(date, i));
        }

        // Get unique transporter IDs from routes on this date
        const transporterIds = [...new Set(routeDrivers.map((r: any) => r.transporterId))];

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
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { date, rows } = body;

        if (!date || !rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: "date and rows[] are required" }, { status: 400 });
        }

        await connectToDatabase();

        const dateObj = new Date(date);

        // Filter rows that have at least one non-empty field (don't save completely empty rows)
        const dataFields = ["routeNumber", "stopCount", "packageCount", "routeDuration", "waveTime", "pad", "wst", "wstDuration", "bags", "ov", "stagingLocation", "transporterId"];

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

        // For rows that have a transporterId, apply their info to SYMXRoutes
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
                // Don't fail the whole request if SYMXRoute sync fails
                console.error("Error syncing to SYMXRoutes:", e);
            }
        }

        return NextResponse.json({ ok: true, saved: ops.length, synced: rowsWithTransporter.length });
    } catch (error: any) {
        console.error("Error saving routes info:", error);
        return NextResponse.json({ error: error.message || "Failed to save" }, { status: 500 });
    }
}

// PUT: Update a single cell/row instantly (for real-time cell editing)
export async function PUT(req: NextRequest) {
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

        // Upsert the specific field
        const result = await SYMXRoutesInfo.findOneAndUpdate(
            { date: dateObj, rowIndex },
            { $set: { [field]: value || "", date: dateObj, rowIndex } },
            { upsert: true, new: true, lean: true }
        );

        // If transporterId is set on this row, sync to SYMXRoute
        const row = result as any;
        if (row?.transporterId && row.transporterId.trim() !== "") {
            const syncFields: Record<string, any> = {};
            const fieldsToSync = ["routeNumber", "stopCount", "packageCount", "routeDuration", "waveTime", "pad", "wst", "wstDuration", "bags", "ov", "stagingLocation"];

            // If the changed field is one that should sync
            if (fieldsToSync.includes(field)) {
                syncFields[field] = field === "stopCount" || field === "packageCount" || field === "wstDuration"
                    ? parseInt(value) || 0
                    : value || "";
            }

            // Also sync if transporterId was just set — push all fields
            if (field === "transporterId") {
                fieldsToSync.forEach(f => {
                    const val = row[f] || "";
                    syncFields[f] = (f === "stopCount" || f === "packageCount" || f === "wstDuration")
                        ? parseInt(val) || 0
                        : val;
                });
            }

            if (Object.keys(syncFields).length > 0) {
                try {
                    await SYMXRoute.updateOne(
                        { transporterId: row.transporterId, date: dateObj },
                        { $set: syncFields }
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
