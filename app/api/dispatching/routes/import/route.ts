import { requirePermission, ForbiddenError } from "@/lib/auth/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SYMXRoutesInfo from "@/lib/models/SYMXRoutesInfo";

// ── Full day names for weekDay field ──
const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ── Header map: CSV column name → schema field name ──
// Supports both human-friendly and camelCase headers
const ROUTE_HEADER_MAP: Record<string, string> = {
    // camelCase (direct match)
    "date": "date",
    "yearWeek": "yearWeek",
    "transporterId": "transporterId",
    "type": "type",
    "subType": "subType",
    "trainingDay": "trainingDay",
    "routeSize": "routeSize",
    "van": "van",
    "serviceType": "serviceType",
    "dashcam": "dashcam",
    "routeNumber": "routeNumber",
    "stopCount": "stopCount",
    "packageCount": "packageCount",
    "routeDuration": "routeDuration",
    "waveTime": "waveTime",
    "pad": "pad",
    "wst": "wst",
    "wstDuration": "wstDuration",
    "wstRevenue": "wstRevenue",
    "notes": "notes",
    "stagingLocation": "stagingLocation",
    "extraStops": "extraStops",
    "stopsRescued": "stopsRescued",
    "departureDelay": "departureDelay",
    "actualDepartureTime": "actualDepartureTime",
    "plannedOutboundStem": "plannedOutboundStem",
    "actualOutboundStem": "actualOutboundStem",
    "outboundDelay": "outboundDelay",
    "plannedFirstStop": "plannedFirstStop",
    "actualFirstStop": "actualFirstStop",
    "firstStopDelay": "firstStopDelay",
    "plannedLastStop": "plannedLastStop",
    "actualLastStop": "actualLastStop",
    "lastStopDelay": "lastStopDelay",
    "plannedRTSTime": "plannedRTSTime",
    "plannedInboundStem": "plannedInboundStem",
    "estimatedRTSTime": "estimatedRTSTime",
    "plannedDuration1stToLast": "plannedDuration1stToLast",
    "actualDuration1stToLast": "actualDuration1stToLast",
    "stopsPerHour": "stopsPerHour",
    "deliveryCompletionTime": "deliveryCompletionTime",
    "dctDelay": "dctDelay",
    "driverEfficiency": "driverEfficiency",
    "attendance": "attendance",
    "attendanceTime": "attendanceTime",
    "amazonOutLunch": "amazonOutLunch",
    "amazonInLunch": "amazonInLunch",
    "amazonAppLogout": "amazonAppLogout",
    "inspectionTime": "inspectionTime",
    "paycomInDay": "paycomInDay",
    "paycomOutLunch": "paycomOutLunch",
    "paycomInLunch": "paycomInLunch",
    "paycomOutDay": "paycomOutDay",
    "driversUpdatedForLunch": "driversUpdatedForLunch",
    "totalHours": "totalHours",
    "regHrs": "regHrs",
    "otHrs": "otHrs",
    "totalCost": "totalCost",
    "regPay": "regPay",
    "otPay": "otPay",
    "punchStatus": "punchStatus",
    "whc": "whc",
    "bags": "bags",
    "ov": "ov",
    "createdAt": "createdAt",
    "createdBy": "createdBy",

    // Human-friendly / Spaced headers
    "Date": "date",
    "Year Week": "yearWeek",
    "Transporter ID": "transporterId",
    "Type": "type",
    "Sub Type": "subType",
    "Training Day": "trainingDay",
    "Route Size": "routeSize",
    "Van": "van",
    "Service Type": "serviceType",
    "Dashcam": "dashcam",
    "Route Number": "routeNumber",
    "Stop Count": "stopCount",
    "Package Count": "packageCount",
    "Route Duration": "routeDuration",
    "Wave Time": "waveTime",
    "PAD": "pad",
    "WST": "wst",
    "WST Duration": "wstDuration",
    "WST Revenue": "wstRevenue",
    "Notes": "notes",
    "Staging Location": "stagingLocation",
    "Extra Stops": "extraStops",
    "Stops Rescued": "stopsRescued",
    "Departure Delay": "departureDelay",
    "Actual Departure Time": "actualDepartureTime",
    "Planned Outbound Stem": "plannedOutboundStem",
    "Actual Outbound Stem": "actualOutboundStem",
    "Outbound Delay": "outboundDelay",
    "Planned First Stop": "plannedFirstStop",
    "Actual First Stop": "actualFirstStop",
    "First Stop Delay": "firstStopDelay",
    "Planned Last Stop": "plannedLastStop",
    "Actual Last Stop": "actualLastStop",
    "Last Stop Delay": "lastStopDelay",
    "Planned RTS Time": "plannedRTSTime",
    "Planned Inbound Stem": "plannedInboundStem",
    "Estimated RTS Time": "estimatedRTSTime",
    "Planned Duration 1st To Last": "plannedDuration1stToLast",
    "Actual Duration 1st To Last": "actualDuration1stToLast",
    "Stops Per Hour": "stopsPerHour",
    "Delivery Completion Time": "deliveryCompletionTime",
    "DCT Delay": "dctDelay",
    "Driver Efficiency": "driverEfficiency",
    "Attendance": "attendance",
    "Attendance Time": "attendanceTime",
    "Amazon Out Lunch": "amazonOutLunch",
    "Amazon In Lunch": "amazonInLunch",
    "Amazon App Logout": "amazonAppLogout",
    "Inspection Time": "inspectionTime",
    "Paycom In Day": "paycomInDay",
    "Paycom Out Lunch": "paycomOutLunch",
    "Paycom In Lunch": "paycomInLunch",
    "Paycom Out Day": "paycomOutDay",
    "Drivers Updated For Lunch": "driversUpdatedForLunch",
    "Total Hours": "totalHours",
    "Reg Hrs": "regHrs",
    "OT Hrs": "otHrs",
    "Total Cost": "totalCost",
    "Reg Pay": "regPay",
    "OT Pay": "otPay",
    "Punch Status": "punchStatus",
    "WHC": "whc",
    "Bags": "bags",
    "OV": "ov",
    "Created At": "createdAt",
    "Created By": "createdBy",
};

// Numeric fields that should be parsed as numbers
const NUMERIC_FIELDS = new Set([
    "stopCount", "packageCount", "wstDuration", "wstRevenue",
    "extraStops", "stopsRescued", "stopsPerHour",
    "driverEfficiency", "totalCost", "regPay", "otPay",
]);

// Fields that belong to SYMXRoutesInfo (synced alongside SYMXRoutes)
const ROUTES_INFO_FIELDS = new Set([
    "routeNumber", "stopCount", "packageCount", "routeDuration",
    "waveTime", "pad", "wst", "wstDuration", "bags", "ov", "stagingLocation",
]);

/**
 * Compute yearWeek (Sunday-based) from a Date object.
 * Must match the inverse of getWeekDates() used throughout the app.
 * Weeks run Sun–Sat.
 */
function dateToSundayWeek(date: Date): string {
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

// POST: Import route records from CSV data
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
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { data } = body;

        if (!data || !Array.isArray(data) || data.length === 0) {
            return NextResponse.json({ error: "No valid data provided" }, { status: 400 });
        }

        await connectToDatabase();

        // ── Process rows ──
        const routeOps: any[] = [];
        const routesInfoMap = new Map<string, { date: Date; transporterId: string; fields: Record<string, any> }>();
        let skipped = 0;

        for (const row of data) {
            const mapped: Record<string, any> = {};

            // Map CSV headers to schema fields
            for (const [header, value] of Object.entries(row)) {
                const trimmedHeader = header.trim();
                const schemaKey = ROUTE_HEADER_MAP[trimmedHeader];
                if (!schemaKey) continue;
                if (value === undefined || value === null || value === "") continue;

                if (NUMERIC_FIELDS.has(schemaKey)) {
                    const num = parseFloat(value as string);
                    mapped[schemaKey] = isNaN(num) ? 0 : num;
                } else {
                    mapped[schemaKey] = (value as string).toString().trim();
                }
            }

            // Must have transporterId and date
            if (!mapped.transporterId || !mapped.date) {
                skipped++;
                continue;
            }

            // Parse and normalize date — timezone-safe
            let dateObj: Date | null = null;
            {
                const raw = String(mapped.date).trim();
                let y = 0, m = 0, d = 0;

                // M/D/YYYY or MM/DD/YYYY
                const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                // YYYY-MM-DD (may include time portion)
                const dashMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

                if (slashMatch) {
                    m = parseInt(slashMatch[1]);
                    d = parseInt(slashMatch[2]);
                    y = parseInt(slashMatch[3]);
                } else if (dashMatch) {
                    y = parseInt(dashMatch[1]);
                    m = parseInt(dashMatch[2]);
                    d = parseInt(dashMatch[3]);
                } else {
                    // Fallback: parse and use LOCAL date components (not UTC)
                    const parsed = new Date(raw);
                    if (!isNaN(parsed.getTime())) {
                        y = parsed.getFullYear();
                        m = parsed.getMonth() + 1;
                        d = parsed.getDate();
                    }
                }

                if (y > 0 && m > 0 && d > 0) {
                    dateObj = new Date(Date.UTC(y, m - 1, d));
                }
            }

            if (!dateObj) {
                skipped++;
                continue;
            }

            // Compute weekDay
            const weekDay = FULL_DAY_NAMES[dateObj.getUTCDay()];

            // Use yearWeek from CSV if provided, otherwise compute from date
            const yearWeek = mapped.yearWeek || dateToSundayWeek(dateObj);

            // Build the $set payload (exclude date, transporterId as they go into filter)
            const setFields: Record<string, any> = {
                weekDay,
                yearWeek,
            };

            // Copy all mapped fields except date/transporterId/yearWeek (those are handled above)
            for (const [key, val] of Object.entries(mapped)) {
                if (key === "date" || key === "transporterId" || key === "yearWeek") continue;

                // Handle special types
                if (key === "whc" || key === "createdAt") {
                    try {
                        const d = new Date(val as string);
                        if (!isNaN(d.getTime())) setFields[key] = d;
                    } catch { }
                } else {
                    setFields[key] = val;
                }
            }

            routeOps.push({
                updateOne: {
                    filter: { transporterId: mapped.transporterId, date: dateObj },
                    update: { $set: setFields },
                    upsert: true,
                },
            });

            // ── Collect RoutesInfo sync data ──
            const infoFields: Record<string, any> = {};
            let hasInfoFields = false;
            for (const field of ROUTES_INFO_FIELDS) {
                if (mapped[field] !== undefined) {
                    infoFields[field] = mapped[field];
                    hasInfoFields = true;
                }
            }

            if (hasInfoFields) {
                const dateKey = `${dateObj.toISOString().split("T")[0]}_${mapped.transporterId}`;
                routesInfoMap.set(dateKey, {
                    date: dateObj,
                    transporterId: mapped.transporterId,
                    fields: { ...infoFields, transporterId: mapped.transporterId },
                });
            }
        }

        if (routeOps.length === 0) {
            return NextResponse.json({
                error: "No valid rows to import. Ensure each row has 'transporterId' and 'date'.",
            }, { status: 400 });
        }

        // ── Bulk upsert SYMXRoutes ──
        const routeResult = await SYMXRoute.bulkWrite(routeOps, { ordered: false });
        const routeCount = (routeResult.upsertedCount || 0) + (routeResult.modifiedCount || 0);

        // ── Sync to SYMXRoutesInfo ──
        let infoSynced = 0;
        if (routesInfoMap.size > 0) {
            // For each unique date, find the next available rowIndex
            const dateGroups = new Map<string, typeof routesInfoMap extends Map<any, infer V> ? V[] : never>();
            for (const [, entry] of routesInfoMap) {
                const dateKey = entry.date.toISOString().split("T")[0];
                if (!dateGroups.has(dateKey)) dateGroups.set(dateKey, []);
                dateGroups.get(dateKey)!.push(entry);
            }

            const infoOps: any[] = [];

            for (const [, entries] of dateGroups) {
                const dateObj = entries[0].date;

                // Find existing RoutesInfo rows for this date to determine next rowIndex
                const existingRows = await SYMXRoutesInfo.find(
                    { date: dateObj },
                    { rowIndex: 1, transporterId: 1 }
                ).sort({ rowIndex: -1 }).lean() as any[];

                // Build transporterId → rowIndex map from existing data
                const existingTransporterMap = new Map<string, number>();
                existingRows.forEach((r: any) => {
                    if (r.transporterId) existingTransporterMap.set(r.transporterId, r.rowIndex);
                });

                let nextRowIndex = existingRows.length > 0 ? existingRows[0].rowIndex + 1 : 0;

                for (const entry of entries) {
                    // If transporter already has a row, update it; otherwise use next available rowIndex
                    const existingRowIndex = existingTransporterMap.get(entry.transporterId);
                    const rowIndex = existingRowIndex !== undefined ? existingRowIndex : nextRowIndex++;

                    infoOps.push({
                        updateOne: {
                            filter: { date: dateObj, rowIndex },
                            update: {
                                $set: {
                                    date: dateObj,
                                    rowIndex,
                                    ...entry.fields,
                                },
                            },
                            upsert: true,
                        },
                    });
                }
            }

            if (infoOps.length > 0) {
                const infoResult = await SYMXRoutesInfo.bulkWrite(infoOps, { ordered: false });
                infoSynced = (infoResult.upsertedCount || 0) + (infoResult.modifiedCount || 0);
            }
        }

        console.log(`[Import Routes] Imported ${routeCount} routes, synced ${infoSynced} RoutesInfo rows, skipped ${skipped}`);

        return NextResponse.json({
            success: true,
            count: routeCount,
            inserted: routeResult.upsertedCount || 0,
            updated: routeResult.modifiedCount || 0,
            infoSynced,
            skipped,
        });
    } catch (error: any) {
        console.error("[Import Routes] Error:", error);
        return NextResponse.json({ error: error.message || "Import failed" }, { status: 500 });
    }
}
