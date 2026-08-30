import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Site from "@/lib/models/Site";
import SYMXRoutesInfo from "@/lib/models/SYMXRoutesInfo";
import SYMXRoute from "@/lib/models/SYMXRoute";
import SymxEmployee from "@/lib/models/SymxEmployee";
import DropdownOption from "@/lib/models/DropdownOption";
import SYMXWSTOption from "@/lib/models/SYMXWSTOption";

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

// Helper: format seconds to H:MM
function fmtDurSecs(totalSecs: number | null): string {
    if (totalSecs === null || isNaN(totalSecs as number) || totalSecs <= 0) return "";
    const abs = Math.abs(Math.round(totalSecs));
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    return `${h}:${m.toString().padStart(2, "0")}`;
}

// Helper: Parse Amazon's routeDuration (in SECONDS) to "H:MM"
function parseAmazonDuration(dur: any): string {
    if (!dur) return "";
    
    // Already in H:MM format
    if (typeof dur === "string" && /^\d{1,2}:\d{2}$/.test(dur)) return dur;
    
    // If it's H:MM:SS, strip the seconds
    if (typeof dur === "string" && /^\d{1,2}:\d{2}:\d{2}$/.test(dur)) {
        return dur.substring(0, dur.lastIndexOf(":"));
    }
    
    // "8h 30m" or "8h30m" format
    if (typeof dur === "string") {
        const match = dur.match(/(\d+)h\s*(\d+)m/i);
        if (match) return `${match[1]}:${match[2].padStart(2, "0")}`;
        
        // Just hours: "8h"
        const hMatch = dur.match(/(\d+)h/i);
        if (hMatch) return `${hMatch[1]}:00`;
        
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
    
    // Handle epoch milliseconds
    if (typeof time === "number" && time > 1000000000000) {
        return new Date(time).toLocaleString("en-US", {
            timeZone: "America/Los_Angeles",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    }
    
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

// Helper: convert a time string like "10:40 AM" or "11:00AM" to minutes since midnight
// Returns -1 if parsing fails
function timeToMinutes(time: string): number {
    if (!time) return -1;
    const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return -1;
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return h * 60 + m;
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

    // ── Which station does each route belong to? ──
    //
    // Answered PER ROUTE from the payload, not once per request. Amazon
    // stamps every route with a serviceAreaId identifying the station that
    // produced it, and that is better evidence than anything the browser
    // can tell us: a ?station= parameter can be stale, left over from
    // another tab, or simply wrong, and when it is wrong the routes are
    // filed under the wrong station with nothing to indicate it.
    //
    // ?station=CODE is still accepted, as a fallback for service areas
    // that have not been mapped yet.
    const sites: any[] = await Site.find(
      { status: "active" },
      { _id: 1, code: 1, name: 1, amazon: 1 }
    ).lean();

    const siteByServiceArea = new Map<string, any>();
    for (const site of sites) {
      const area = site.amazon?.serviceAreaId;
      if (area) siteByServiceArea.set(String(area).trim(), site);
    }

    const fallbackCode = (new URL(req.url).searchParams.get("station") || "").trim().toUpperCase();
    const fallbackSite = fallbackCode
      ? sites.find((s) => String(s.code || "").toUpperCase() === fallbackCode)
      : null;
    if (fallbackCode && !fallbackSite) {
      return NextResponse.json(
        { error: `No active station with code ${fallbackCode}.` },
        { status: 400 },
      );
    }

    /** The station a single scraped route belongs to, or null if unknown. */
    const siteForRoute = (route: any): any => {
      const raw = route?._raw || route;
      const area = String(route?.serviceAreaId || raw?.serviceAreaId || "").trim();
      if (area) sawAnyServiceArea = true;
      if (area && siteByServiceArea.has(area)) return siteByServiceArea.get(area);
      // No mapping: fall back only if the caller named a station. Guessing
      // here is what puts one station's routes on another's board.
      return fallbackSite || null;
    };

    // Service areas seen in this payload that map to no station. Reported
    // back rather than swallowed — an unmapped area means those routes were
    // silently dropped, and the operator needs to know which id to add in
    // Owner > Stations to fix it.
    const unmappedAreas = new Set<string>();
    let skipped = 0;
    // Whether ANY route in this payload carried a service area at all.
    // Distinguishes "the id is not mapped yet" from "the extension is not
    // sending one" — the same symptom, completely different fix, and the
    // first version of this reported neither.
    let sawAnyServiceArea = false;

        const dateObj = new Date(date);

        console.log(`[Extension Sync] Received ${routes.length} routes for ${date}`);

        // ── Build employee lookup for matching transporterIds ──
        // Fetch all employees and build maps for fuzzy matching
        const allEmployees = await SymxEmployee.find(
            {},
            { transporterId: 1, firstName: 1, lastName: 1, amazonTransporterId: 1, primarySiteId: 1 }
        ).lean() as any[];

        // Amazon's transporter ID is globally unique to a person, so that
        // map stays company-wide — the same driver keeps their ID wherever
        // they work.
        const empByAmazonId = new Map<string, string>();
        // Names are NOT unique and NOT global. Two stations can each employ
        // a "Jose Ruiz", so matching by name across the company would attach
        // one station's driver to another station's route — and the result
        // looks entirely plausible on screen. Keyed by station.
        const empByName = new Map<string, string>();

        allEmployees.forEach((emp: any) => {
            const name = `${emp.firstName} ${emp.lastName}`.trim().toLowerCase();
            if (emp.primarySiteId) {
                empByName.set(`${String(emp.primarySiteId)}|${name}`, emp.transporterId);
            }
            if (emp.amazonTransporterId) {
                empByAmazonId.set(emp.amazonTransporterId, emp.transporterId);
            }
        });

        // ── Resolve every route's station up front ──
        // Done before any lookup so the queries below can be limited to the
        // stations actually present in this payload, and so each map can be
        // keyed BY STATION. Keying by route number alone was safe with one
        // station and silently wrong with two: "CX130" exists at both.
        const routeSites: any[] = routes.map((r: any) => siteForRoute(r));
        const siteIds = Array.from(
            new Set(routeSites.filter(Boolean).map((s: any) => String(s._id)))
        ).map((id) => new mongoose.Types.ObjectId(id));

        // Namespaced keys — station + value — so two stations using the same
        // route code or row index never collide in these maps.
        const keyOf = (siteId: any, value: string) => `${String(siteId)}|${value}`;

        // ── Fetch existing SYMXRoute records for this date to get transporterIds by routeCode ──
        const existingRoutes = await SYMXRoute.find(
            { date: dateObj, siteId: { $in: siteIds } },
            { transporterId: 1, routeNumber: 1, employeeName: 1, siteId: 1 }
        ).lean() as any[];

        // Build a map of station+routeNumber → transporterId from existing routes
        const routeToTransporter = new Map<string, string>();
        existingRoutes.forEach((r: any) => {
            if (r.routeNumber) {
                routeToTransporter.set(keyOf(r.siteId, r.routeNumber.toLowerCase()), r.transporterId);
            }
        });

        // ── Fetch existing SYMXRoutesInfo records for this date to preserve rowIndex ──
        const existingInfoRows = await SYMXRoutesInfo.find(
            { date: dateObj, siteId: { $in: siteIds } },
            { rowIndex: 1, routeNumber: 1, transporterId: 1, siteId: 1 }
        ).sort({ rowIndex: -1 }).lean() as any[];

        // ── Fetch wave time options to map default PAD ──
        const waveTimeOpts = await DropdownOption.find({ type: "wave time", isActive: true }).lean();
        // Build both exact-match and fuzzy-match structures
        const waveTimePadEntries: { description: string; defaultPad: string; minutes: number }[] = [];
        waveTimeOpts.forEach((opt: any) => {
            if (opt.description) {
                const mins = timeToMinutes(opt.description);
                waveTimePadEntries.push({
                    description: opt.description,
                    defaultPad: opt.defaultPad || "",
                    minutes: mins,
                });
            }
        });

        // ── Fetch WST options to map Amazon serviceTypeName → WST ──
        const wstOpts = await SYMXWSTOption.find({ isActive: true }).lean();
        const amazonServiceTypeToWst = new Map<string, string>();
        wstOpts.forEach((opt: any) => {
            if (opt.amazonServiceType && opt.wst) {
                amazonServiceTypeToWst.set(opt.amazonServiceType.trim(), opt.wst.trim());
            }
        });

        const infoRouteMap = new Map<string, number>();
        const infoTransporterMap = new Map<string, number>();
        existingInfoRows.forEach((r: any) => {
            if (r.routeNumber) infoRouteMap.set(keyOf(r.siteId, r.routeNumber.toLowerCase()), r.rowIndex);
            if (r.transporterId) infoTransporterMap.set(keyOf(r.siteId, r.transporterId), r.rowIndex);
        });

        // Row numbering restarts per station — each station's grid is its
        // own sheet, so DXC8's first row is 0 even when DFO2 already has 40.
        // A single shared counter would leave permanent gaps in both.
        const nextRowIndexBySite = new Map<string, number>();
        for (const row of existingInfoRows) {
            const k = String(row.siteId);
            // existingInfoRows is sorted by rowIndex descending, so the first
            // row seen for a station carries its highest index.
            if (!nextRowIndexBySite.has(k)) nextRowIndexBySite.set(k, row.rowIndex + 1);
        }

        // ── Transform and upsert into SYMXRoutesInfo ──
        let matched = 0;
        const ops: any[] = [];
        const syncOps: any[] = [];

        routes.forEach((route: any, index: number) => {
            const routeSite = routeSites[index];
            if (!routeSite) {
                // Unknown service area and no ?station= fallback. Skipped
                // rather than guessed: a route written to the wrong station
                // is invisible to the people who need it and clutters a
                // board it does not belong on.
                const raw0 = route?._raw || route;
                const area = String(route?.serviceAreaId || raw0?.serviceAreaId || "").trim();
                if (area) unmappedAreas.add(area);
                skipped++;
                return;
            }
            const siteId = routeSite._id;
            const routeCode = route.routeCode || "";

            // Try to match to an existing employee
            let transporterId = "";

            // 1. Try Amazon transporterId
            if (route.transporterId && empByAmazonId.has(route.transporterId)) {
                transporterId = empByAmazonId.get(route.transporterId) || "";
                matched++;
            }
            // 2. Try by route code match in existing SYMXRoutes
            else if (routeCode && routeToTransporter.has(keyOf(siteId, routeCode.toLowerCase()))) {
                transporterId = routeToTransporter.get(keyOf(siteId, routeCode.toLowerCase())) || "";
                matched++;
            }
            // 3. Try by driver name
            else if (route.transporterName) {
                const name = `${String(siteId)}|${route.transporterName.trim().toLowerCase()}`;
                if (empByName.has(name)) {
                    transporterId = empByName.get(name) || "";
                    matched++;
                }
            }

            // ── Resolve stopCount, packageCount from raw data ──
            const raw = route._raw || route;
            // routeDeliveryProgress is checked FIRST because it is where the
            // real figures are. The top-level `totalStops` and `totalTasks`
            // are present but zero on live payloads, and `||` treats 0 as
            // absent, so the previous order fell through every candidate and
            // wrote 0 — the two numbers dispatch cares about most were
            // silently blank on every synced route.
            const progress = raw.routeDeliveryProgress || route.routeDeliveryProgress || {};
            const firstNumber = (...vals: any[]) => {
                for (const v of vals) {
                    const n = Number(v);
                    if (Number.isFinite(n) && n > 0) return n;
                }
                return 0;
            };
            const resolvedStopCount = firstNumber(
                route.stopCount,
                progress.totalStops,
                raw.totalStops, raw.numberOfStops, raw.plannedStopCount,
            );
            const resolvedPackageCount = firstNumber(
                route.packageCount,
                progress.totalDeliveries,
                progress.totalPickUps,
                raw.deliveriesCompleted, raw.deliveredPackageCount,
                raw.totalPackages, raw.numberOfPackages, raw.plannedPackageCount,
            );

            // ── waveTime = plannedDepartureTime - 20 mins ──
            // Amazon's plannedDepartureTime is epoch ms (e.g. 1775586000000)
            const rawDeparture = raw.plannedDepartureTime || route.departureTime || raw.departureTime || "";
            let resolvedWaveTime = "";
            if (rawDeparture) {
                resolvedWaveTime = subtractMinutes(rawDeparture, 20);
            }

            // ── plannedFirstStop = plannedStart ──
            const plannedStartRaw = raw.transporters?.[0]?.plannedBreaks?.[0]?.plannedStart || route.plannedFirstStop;
            let resolvedPlannedFirstStop = "";
            if (plannedStartRaw) {
               resolvedPlannedFirstStop = subtractMinutes(plannedStartRaw, 0);
            }

            // ── Determine rowIndex to prevent duplicates ──
            let rowIndex: number;
            const lowerRouteCode = routeCode.toLowerCase();
            const rawTransporterId = route.transporterId || raw.transporterIdFromRms || "";

            if (routeCode && infoRouteMap.has(keyOf(siteId, lowerRouteCode))) {
                rowIndex = infoRouteMap.get(keyOf(siteId, lowerRouteCode))!;
            } else if (transporterId && infoTransporterMap.has(keyOf(siteId, transporterId))) {
                rowIndex = infoTransporterMap.get(keyOf(siteId, transporterId))!;
            } else if (rawTransporterId && infoTransporterMap.has(keyOf(siteId, rawTransporterId))) {
                rowIndex = infoTransporterMap.get(keyOf(siteId, rawTransporterId))!;
            } else {
                // New row for this station. `index` is not usable as a
                // fallback any more — it is the position in a payload that
                // may span stations, so it would hand two stations' routes
                // the same row number.
                const siteKey = String(siteId);
                rowIndex = nextRowIndexBySite.get(siteKey) ?? 0;
                nextRowIndexBySite.set(siteKey, rowIndex + 1);
                if (routeCode) infoRouteMap.set(keyOf(siteId, lowerRouteCode), rowIndex);
                if (transporterId) infoTransporterMap.set(keyOf(siteId, transporterId), rowIndex);
                if (rawTransporterId) infoTransporterMap.set(keyOf(siteId, rawTransporterId), rowIndex);
            }

            // Parse route data into SYMX format
            const parsedWaveTime = parseAmazonTime(resolvedWaveTime);

            // ── Match waveTime to nearest dropdown option & get default PAD ──
            let matchedWaveTime = parsedWaveTime;
            let matchedPad = "";
            if (parsedWaveTime && waveTimePadEntries.length > 0) {
                const inputMins = timeToMinutes(parsedWaveTime);
                if (inputMins >= 0) {
                    // Find the closest wave time option (within 30 min tolerance)
                    let bestMatch: typeof waveTimePadEntries[0] | null = null;
                    let bestDiff = Infinity;
                    for (const entry of waveTimePadEntries) {
                        if (entry.minutes < 0) continue;
                        const diff = Math.abs(entry.minutes - inputMins);
                        if (diff < bestDiff) {
                            bestDiff = diff;
                            bestMatch = entry;
                        }
                    }
                    // Only match if within 30 minutes
                    if (bestMatch && bestDiff <= 30) {
                        matchedWaveTime = bestMatch.description;
                        matchedPad = bestMatch.defaultPad;
                    }
                }
            }

            const row: Record<string, any> = {
                date: dateObj,
                siteId,
                rowIndex,
                routeNumber: routeCode,
                stopCount: String(resolvedStopCount),
                packageCount: String(resolvedPackageCount),
                routeDuration: parseAmazonDuration(route.routeDuration || raw.routeDuration || raw.duration),
                waveTime: matchedWaveTime,
                pad: matchedPad,
                // Store the matched SYMX transporterId (fallback to raw Amazon ID if not matched)
                transporterId: transporterId || rawTransporterId,
                rawSummary: raw,  // Store full Amazon route-summaries JSON
            };

            // ── Map Amazon serviceTypeName to internal WST via DB config ──
            const serviceTypeName = route.serviceTypeName || raw.serviceTypeName;
            if (serviceTypeName) {
                const mappedWst = amazonServiceTypeToWst.get(serviceTypeName.trim());
                row.wst = mappedWst || serviceTypeName;
            }

            // ── Deep search for blockDurationInMinutes anywhere in the payload ──
            const findKeyDeep = (obj: any, targetKey: string): any => {
                if (!obj || typeof obj !== 'object') return undefined;
                if (targetKey in obj) return obj[targetKey];
                for (const key in obj) {
                    const found = findKeyDeep(obj[key], targetKey);
                    if (found !== undefined) return found;
                }
                return undefined;
            };

            let blockDuration = findKeyDeep(route, "blockDurationInMinutes");
            if (blockDuration === undefined || blockDuration === null || blockDuration === "") {
                if (typeof raw === "string") {
                    try {
                        const parsed = JSON.parse(raw);
                        blockDuration = findKeyDeep(parsed, "blockDurationInMinutes");
                    } catch (e) {}
                } else {
                    blockDuration = findKeyDeep(raw, "blockDurationInMinutes");
                }
            }

            if (blockDuration !== undefined && blockDuration !== null && blockDuration !== "") {
                const hours = Number(blockDuration) / 60;
                row.wstDuration = String(hours);
                // Also assign to the route object so syncFields mapping can catch it
                route.wstDuration = hours;
            }

            // Upsert into RoutesInfo by date + rowIndex
            ops.push({
                updateOne: {
                    // siteId is part of the KEY, not just the payload. Without
                    // it, DFO2 row 3 and DXC8 row 3 on the same date are one
                    // document and each station's sync overwrites the other's.
                    filter: { date: dateObj, rowIndex, siteId },
                    update: { 
                        $set: row,
                        $setOnInsert: {
                            bags: "",
                            ov: "",
                            stagingLocation: "",
                            ...(!row.wst ? { wst: "" } : {}),
                            ...(!row.wstDuration ? { wstDuration: "" } : {})
                        }
                    },
                    upsert: true,
                },
            });

            // If we matched a transporterId, also sync to SYMXRoute
            if (transporterId) {
                const syncFields: Record<string, any> = {
                    routeNumber: routeCode,
                    // The resolved values, not the raw ones. These used to read
                    // route.stopCount directly while the grid row used the
                    // fallback chain, so the two collections disagreed about
                    // the same route whenever Amazon nested the figures.
                    stopCount: resolvedStopCount,
                    packageCount: resolvedPackageCount,
                    routeDuration: parseAmazonDuration(
                        route.routeDuration || raw.routeDuration || raw.duration,
                    ),
                };

                // Add time fields if available
                if (matchedWaveTime) syncFields.waveTime = matchedWaveTime;
                if (route.departureTime) syncFields.actualDepartureTime = parseAmazonTime(route.departureTime);
                if (route.firstStopTime) syncFields.actualFirstStop = parseAmazonTime(route.firstStopTime);
                if (route.lastStopTime) syncFields.actualLastStop = parseAmazonTime(route.lastStopTime);
                if (route.completionTime) syncFields.deliveryCompletionTime = parseAmazonTime(route.completionTime);
                if (route.outboundStem) syncFields.actualOutboundStem = parseAmazonTime(route.outboundStem);
                if (route.stopsPerHour) syncFields.stopsPerHour = parseFloat(route.stopsPerHour) || 0;
                if (resolvedPlannedFirstStop) syncFields.plannedFirstStop = resolvedPlannedFirstStop;

                if (row.wst) syncFields.wst = row.wst;
                if (row.wstDuration) syncFields.wstDuration = Number(row.wstDuration) || 0;
                if (matchedPad) syncFields.pad = matchedPad;

                const scheduleEnd = route.scheduleEndTime || raw.scheduleEndTime;
                if (scheduleEnd) syncFields.amazonAppLogout = parseAmazonTime(scheduleEnd);

                syncOps.push({
                    updateOne: {
                        filter: { transporterId, date: dateObj, siteId },
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

        // Nothing synced at all is a failure, not a quiet success. Returning
        // ok:true with saved:0 is why this could stop working without anyone
        // noticing: the extension sees 200 and carries on.
        if (skipped === routes.length && routes.length > 0) {
            const mappedCount = siteByServiceArea.size;
            const reason = !sawAnyServiceArea
                ? "None of the routes carried a serviceAreaId, and no ?station=CODE was given. " +
                  "Either add ?station=CODE to the sync URL, or have the extension include " +
                  "Amazon's raw route summary (which contains serviceAreaId)."
                : mappedCount === 0
                ? "No station has an Amazon service area configured yet. Set it in " +
                  "Owner > Stations > Amazon Logistics — the ids seen were: " +
                  `${[...unmappedAreas].join(", ")}`
                : "The service area(s) in this payload are not mapped to any station: " +
                  `${[...unmappedAreas].join(", ")}. Add the id in Owner > Stations.`;

            return NextResponse.json(
                {
                    ok: false,
                    error: `All ${routes.length} route(s) were skipped — nothing was synced.`,
                    reason,
                    skipped,
                    unmappedServiceAreas: [...unmappedAreas],
                    stationsWithServiceArea: sites
                        .filter((x: any) => x.amazon?.serviceAreaId)
                        .map((x: any) => x.code),
                },
                { status: 422, headers: corsHeaders },
            );
        }

        return NextResponse.json({
            ok: true,
            saved,
            synced,
            matched,
            total: routes.length,
            // Silence about dropped routes is what lets a misconfigured
            // service area go unnoticed for a week, so the count and the
            // offending ids come back with the success response.
            skipped,
            unmappedServiceAreas: Array.from(unmappedAreas),
            ...(unmappedAreas.size > 0
                ? {
                      warning:
                          `${skipped} route(s) were not synced: their Amazon service area is not ` +
                          `mapped to a station. Add the id in Owner > Stations.`,
                  }
                : {}),
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
