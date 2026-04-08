import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SYMXRoutesInfo from "@/lib/models/SYMXRoutesInfo";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEmployee from "@/lib/models/SymxEmployee";

/**
 * ══════════════════════════════════════════════════════════════
 * PUBLIC API — Chrome Extension Route Sync
 * ══════════════════════════════════════════════════════════════
 * Receives scraped Amazon Logistics route data from the Chrome extension
 * and populates the SYMXRoutesInfo collection for the given date.
 * Also syncs matching fields to SYMXRoute records (by routeCode → transporterId).
 *
 * Authentication: Public endpoint under /api/public/ — no auth required
 * ══════════════════════════════════════════════════════════════
 */

// Helper: format seconds to H:MM:SS
function fmtDurSecs(totalSecs: number | null): string {
    if (totalSecs === null || isNaN(totalSecs as number) || totalSecs <= 0) return "";
    const abs = Math.abs(Math.round(totalSecs));
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = abs % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// Helper: Parse Amazon's routeDuration (in SECONDS) to "H:MM:SS"
function parseAmazonDuration(dur: any): string {
    if (!dur) return "";
    
    // Already in H:MM or H:MM:SS format
    if (typeof dur === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(dur)) return dur;
    
    // "8h 30m" or "8h30m" format
    if (typeof dur === "string") {
        const match = dur.match(/(\d+)h\s*(\d+)m/i);
        if (match) return `${match[1]}:${match[2].padStart(2, "0")}:00`;
        
        // Just hours: "8h"
        const hMatch = dur.match(/(\d+)h/i);
        if (hMatch) return `${hMatch[1]}:00:00`;
        
        // Just minutes: "30m"
        const mMatch = dur.match(/(\d+)m/i);
        if (mMatch) return fmtDurSecs(parseInt(mMatch[1]) * 60);
    }
    
    // Numeric — Amazon sends routeDuration in SECONDS
    if (typeof dur === "number") return fmtDurSecs(dur);

    return String(dur);
}

// Helper: Parse Amazon time to "H:MM AM/PM" format
function parseAmazonTime(time: any): string {
    if (!time) return "";
    if (typeof time === "string") {
        // Already formatted
        if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(time)) return time;
        // ISO date string
        if (time.includes("T")) {
            try {
                const d = new Date(time);
                const h = d.getUTCHours();
                const m = d.getUTCMinutes();
                const ampm = h >= 12 ? "PM" : "AM";
                const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
            } catch { }
        }
        // HH:MM 24h format
        if (/^\d{1,2}:\d{2}$/.test(time)) {
            const [h, m] = time.split(":").map(Number);
            const ampm = h >= 12 ? "PM" : "AM";
            const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
            return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
        }
    }
    return String(time);
}

// Helper: subtract N minutes from a time value and return formatted string in Pacific time
function subtractMinutes(time: any, mins: number): string {
    if (!time) return "";
    let d: Date | null = null;

    // Epoch ms
    if (typeof time === "number" && time > 1000000000000) {
        d = new Date(time - mins * 60000);
    }
    // ISO string
    else if (typeof time === "string" && time.includes("T")) {
        try { d = new Date(new Date(time).getTime() - mins * 60000); } catch { /* ignore */ }
    }
    // "H:MM AM/PM"
    else if (typeof time === "string") {
        const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (match) {
            let h = parseInt(match[1]);
            const m = parseInt(match[2]);
            const ampm = match[3].toUpperCase();
            if (ampm === "PM" && h !== 12) h += 12;
            if (ampm === "AM" && h === 12) h = 0;
            const total = h * 60 + m - mins;
            const nh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
            const nm = ((total % 1440) + 1440) % 1440 % 60;
            const ap = nh >= 12 ? "PM" : "AM";
            const h12 = nh === 0 ? 12 : nh > 12 ? nh - 12 : nh;
            return `${h12}:${nm.toString().padStart(2, "0")} ${ap}`;
        }
    }

    if (d) {
        // Format in Pacific time (Amazon station timezone)
        return d.toLocaleString("en-US", {
            timeZone: "America/Los_Angeles",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    }

    return "";
}

export async function POST(req: NextRequest) {
    // Add CORS headers to all responses
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-extension-key",
    };

    try {

        const body = await req.json();
        const { routes, date } = body;

        if (!routes || !Array.isArray(routes) || routes.length === 0) {
            return NextResponse.json({ error: "routes array is required" }, { status: 400 });
        }
        if (!date) {
            return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 });
        }

        await connectToDatabase();

        const dateObj = new Date(date);

        console.log(`[Extension Sync] Received ${routes.length} routes for ${date}`);

        // ── Build employee lookup for matching transporterIds ──
        // Fetch all employees and build maps for fuzzy matching
        const allEmployees = await SymxEmployee.find(
            {},
            { transporterId: 1, firstName: 1, lastName: 1, amazonTransporterId: 1 }
        ).lean() as any[];

        const empByAmazonId = new Map<string, string>();
        const empByName = new Map<string, string>();
        
        allEmployees.forEach((emp: any) => {
            const name = `${emp.firstName} ${emp.lastName}`.trim().toLowerCase();
            empByName.set(name, emp.transporterId);
            if (emp.amazonTransporterId) {
                empByAmazonId.set(emp.amazonTransporterId, emp.transporterId);
            }
        });

        // ── Fetch existing SYMXRoute records for this date to get transporterIds by routeCode ──
        const existingRoutes = await SYMXRoute.find(
            { date: dateObj },
            { transporterId: 1, routeNumber: 1, employeeName: 1 }
        ).lean() as any[];

        // Build a map of routeNumber → transporterId from existing routes
        const routeToTransporter = new Map<string, string>();
        existingRoutes.forEach((r: any) => {
            if (r.routeNumber) {
                routeToTransporter.set(r.routeNumber.toLowerCase(), r.transporterId);
            }
        });

        // ── Transform and upsert into SYMXRoutesInfo ──
        let matched = 0;
        const ops: any[] = [];
        const syncOps: any[] = [];

        routes.forEach((route: any, index: number) => {
            const routeCode = route.routeCode || "";
            
            // Try to match to an existing employee
            let transporterId = "";
            
            // 1. Try Amazon transporterId
            if (route.transporterId && empByAmazonId.has(route.transporterId)) {
                transporterId = empByAmazonId.get(route.transporterId) || "";
                matched++;
            }
            // 2. Try by route code match in existing SYMXRoutes
            else if (routeCode && routeToTransporter.has(routeCode.toLowerCase())) {
                transporterId = routeToTransporter.get(routeCode.toLowerCase()) || "";
                matched++;
            }
            // 3. Try by driver name
            else if (route.transporterName) {
                const name = route.transporterName.trim().toLowerCase();
                if (empByName.has(name)) {
                    transporterId = empByName.get(name) || "";
                    matched++;
                }
            }

            // ── Resolve stopCount, packageCount from raw data ──
            const raw = route._raw || route;
            const resolvedStopCount =
                route.stopCount || raw.totalStops || raw.numberOfStops || raw.plannedStopCount || 0;
            const resolvedPackageCount =
                route.packageCount || raw.deliveriesCompleted || raw.deliveredPackageCount ||
                raw.totalPackages || raw.numberOfPackages || raw.plannedPackageCount || 0;

            // ── waveTime = plannedDepartureTime - 20 mins ──
            // Amazon's plannedDepartureTime is epoch ms (e.g. 1775586000000)
            const rawDeparture = raw.plannedDepartureTime || route.departureTime || raw.departureTime || "";
            let resolvedWaveTime = "";
            if (rawDeparture) {
                resolvedWaveTime = subtractMinutes(rawDeparture, 20);
            }

            // Parse route data into SYMX format
            const row: Record<string, any> = {
                date: dateObj,
                rowIndex: index,
                routeNumber: routeCode,
                stopCount: String(resolvedStopCount),
                packageCount: String(resolvedPackageCount),
                routeDuration: parseAmazonDuration(route.routeDuration || raw.routeDuration || raw.duration),
                waveTime: parseAmazonTime(resolvedWaveTime),
                pad: "", // Will be set manually
                wst: "", // Will be set manually
                wstDuration: "",
                bags: "",
                ov: "",
                stagingLocation: "",
                // Store the Amazon transporterId directly (e.g. "A1K8M27DOUL0PC")
                transporterId: route.transporterId || raw.transporterIdFromRms || "",
                rawSummary: raw,  // Store full Amazon route-summaries JSON
            };

            // Upsert into RoutesInfo by date + rowIndex
            ops.push({
                updateOne: {
                    filter: { date: dateObj, rowIndex: index },
                    update: { $set: row },
                    upsert: true,
                },
            });

            // If we matched a transporterId, also sync to SYMXRoute
            if (transporterId) {
                const syncFields: Record<string, any> = {
                    routeNumber: routeCode,
                    stopCount: parseInt(String(route.stopCount)) || 0,
                    packageCount: parseInt(String(route.packageCount)) || 0,
                    routeDuration: parseAmazonDuration(route.routeDuration),
                };

                // Add time fields if available
                if (route.waveTime) syncFields.waveTime = parseAmazonTime(route.waveTime);
                if (route.departureTime) syncFields.actualDepartureTime = parseAmazonTime(route.departureTime);
                if (route.firstStopTime) syncFields.actualFirstStop = parseAmazonTime(route.firstStopTime);
                if (route.lastStopTime) syncFields.actualLastStop = parseAmazonTime(route.lastStopTime);
                if (route.completionTime) syncFields.deliveryCompletionTime = parseAmazonTime(route.completionTime);
                if (route.outboundStem) syncFields.actualOutboundStem = parseAmazonTime(route.outboundStem);
                if (route.stopsPerHour) syncFields.stopsPerHour = parseFloat(route.stopsPerHour) || 0;

                syncOps.push({
                    updateOne: {
                        filter: { transporterId, date: dateObj },
                        update: { $set: syncFields },
                    },
                });
            }
        });

        // Execute RoutesInfo upserts
        let saved = 0;
        if (ops.length > 0) {
            const result = await SYMXRoutesInfo.bulkWrite(ops, { ordered: false });
            saved = result.upsertedCount + result.modifiedCount;
        }

        // Execute SYMXRoute syncs
        let synced = 0;
        if (syncOps.length > 0) {
            try {
                const result = await SYMXRoute.bulkWrite(syncOps, { ordered: false });
                synced = result.modifiedCount;
            } catch (e) {
                console.error("[Extension Sync] Error syncing to SYMXRoutes:", e);
            }
        }

        console.log(`[Extension Sync] Complete: ${saved} info rows saved, ${synced} routes synced, ${matched} drivers matched`);

        return NextResponse.json({
            ok: true,
            saved,
            synced,
            matched,
            total: routes.length,
        }, { headers: corsHeaders });
    } catch (error: any) {
        console.error("[Extension Sync] Error:", error);
        return NextResponse.json(
            { error: error.message || "Sync failed" },
            { status: 500, headers: corsHeaders }
        );
    }
}

// OPTIONS for CORS preflight (Chrome extension → external API)
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-extension-key",
        },
    });
}
