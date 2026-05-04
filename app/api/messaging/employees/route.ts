import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployee from "@/lib/models/SymxEmployee";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SYMXRoute from "@/lib/models/SYMXRoute";
import MessageLog from "@/lib/models/MessageLog";
import ScheduleConfirmation from "@/lib/models/ScheduleConfirmation";
import { TAB_TO_SCHEDULE_FIELD } from "@/lib/messaging-constants";
import RouteType from "@/lib/models/RouteType";

/** Business timezone — all "today" / "tomorrow" checks use Pacific Time. */
const BUSINESS_TZ = "America/Los_Angeles";

function getTodayPacific(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
}

function getTomorrowPacific(): string {
  const todayStr = getTodayPacific();
  const d = new Date(todayStr + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}

/** Convert any date to YYYY-MM-DD in Pacific Time */
function toPacificDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : new Date(d.getTime());
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) date.setUTCHours(12);
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(date);
}

/** Compute the 7 dates (Sun–Sat) for a given yearWeek string like "2026-W18". */
function getWeekDateStrings(yearWeek: string): string[] {
  const match = yearWeek.match(/(\d{4})-W(\d{2})/);
  if (!match) return [];
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Day = jan1.getUTCDay();
  const firstSunday = new Date(jan1);
  firstSunday.setUTCDate(jan1.getUTCDate() - jan1Day);
  const weekSunday = new Date(firstSunday);
  weekSunday.setUTCDate(firstSunday.getUTCDate() + (week - 1) * 7);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekSunday);
    d.setUTCDate(weekSunday.getUTCDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

/** Compute next yearWeek: "2026-W18" → "2026-W19" */
function getNextYearWeek(yearWeek: string): string {
  const match = yearWeek.match(/(\d{4})-W(\d{2})/);
  if (!match) return yearWeek;
  let year = parseInt(match[1]);
  let week = parseInt(match[2]) + 1;
  if (week > 52) { year++; week = 1; }
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Compute prev yearWeek: "2026-W19" → "2026-W18" */
function getPrevYearWeek(yearWeek: string): string {
  const match = yearWeek.match(/(\d{4})-W(\d{2})/);
  if (!match) return yearWeek;
  let year = parseInt(match[1]);
  let week = parseInt(match[2]) - 1;
  if (week < 1) { year--; week = 52; }
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter");
    const yearWeek = searchParams.get("yearWeek");
    const date = searchParams.get("date");

    await connectToDatabase();

    // ── Detect cross-week boundary ──
    // When the target date falls outside the selected week, also fetch adjacent week's schedules.
    let adjacentWeeks: string[] = [];
    if (yearWeek) {
      let checkDate = date || "";
      if (!checkDate && (filter === "future-shift" || filter === "off-tomorrow")) {
        checkDate = getTomorrowPacific();
      } else if (!checkDate && (filter === "shift" || filter === "route-itinerary")) {
        checkDate = getTodayPacific();
      }
      if (checkDate) {
        const weekDates = getWeekDateStrings(yearWeek);
        if (weekDates.length > 0 && !weekDates.includes(checkDate)) {
          // Check if date is before or after the week — fetch the correct adjacent week
          adjacentWeeks.push(getNextYearWeek(yearWeek));
          adjacentWeeks.push(getPrevYearWeek(yearWeek));
        }
      }
      // For off-tomorrow, also check the previous day which might be in a different week
      if (filter === "off-tomorrow" && checkDate) {
        const prevDay = new Date(checkDate + "T12:00:00.000Z");
        prevDay.setUTCDate(prevDay.getUTCDate() - 1);
        const prevDayStr = prevDay.toISOString().split("T")[0];
        const weekDates = getWeekDateStrings(yearWeek);
        if (!weekDates.includes(prevDayStr)) {
          const prev = getPrevYearWeek(yearWeek);
          if (!adjacentWeeks.includes(prev)) adjacentWeeks.push(prev);
        }
      }
    }

    // ── Run all queries IN PARALLEL for maximum speed ──
    const employeePromise = SymxEmployee.find(
      { status: "Active", phoneNumber: { $exists: true, $ne: "" } },
      { _id: 1, firstName: 1, lastName: 1, transporterId: 1, phoneNumber: 1, type: 1, status: 1, email: 1 }
    )
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    // Schedule query with PROJECTION — only fetch fields we actually use
    // If cross-week boundary detected, also fetch adjacent week's schedules
    const allWeeks = [yearWeek, ...adjacentWeeks].filter(Boolean);
    const scheduleQuery = yearWeek
      ? (allWeeks.length > 1
        ? { yearWeek: { $in: allWeeks } }
        : { yearWeek })
      : null;
    const schedulePromise = scheduleQuery
      ? SymxEmployeeSchedule.find(
        scheduleQuery,
        { transporterId: 1, date: 1, weekDay: 1, type: 1, typeId: 1, subType: 1, status: 1, routeStatus: 1, startTime: 1, van: 1 }
      )
        .sort({ date: 1 })
        .lean()
      : Promise.resolve(null);

    // Build typeId → { partOf, routeStatus } map for Shift filtering
    const routeTypePromise = RouteType.find({}, { _id: 1, name: 1, partOf: 1, routeStatus: 1 }).lean();

    const routeQuery = yearWeek
      ? (allWeeks.length > 1
        ? { yearWeek: { $in: allWeeks } }
        : { yearWeek })
      : null;
    const routePromise = routeQuery
      ? SYMXRoute.find(
          routeQuery,
          { transporterId: 1, date: 1, routeNumber: 1, stagingLocation: 1, pad: 1, waveTime: 1, van: 1 }
        ).lean()
      : Promise.resolve(null);

    // ── Messaging status — single optimized aggregation ──
    // Combines ScheduleConfirmation + MessageLog lookups into one pipeline
    // For date-specific tabs (shift, future-shift, etc.) scope by scheduleDate;
    // for week-schedule, scope by yearWeek only.
    // If `date` param is provided by frontend, use it; otherwise compute from tab type.
    const DATE_SPECIFIC_TABS = ["shift", "future-shift", "route-itinerary", "off-tomorrow", "flyer"];
    let targetScheduleDate = "";
    if (date) {
      // Frontend explicitly selected a date
      targetScheduleDate = date;
    } else if (filter && DATE_SPECIFIC_TABS.includes(filter)) {
      if (filter === "shift" || filter === "route-itinerary") {
        targetScheduleDate = getTodayPacific();
      } else if (filter === "future-shift" || filter === "off-tomorrow") {
        targetScheduleDate = getTomorrowPacific();
      }
    }

    const messagingStatusPromise = (filter && yearWeek)
      ? (async () => {
        // Step 1: Get messageLogIds scoped to this week+messageType
        // For date-specific tabs, additionally scope by scheduleDate
        const confirmQuery: Record<string, any> = {
          yearWeek, messageType: filter, messageLogId: { $exists: true },
        };
        if (targetScheduleDate) {
          confirmQuery.scheduleDate = { $regex: new RegExp("^" + targetScheduleDate) };
        }
        const weekConfirmations = await ScheduleConfirmation.find(
          confirmQuery,
          { messageLogId: 1, status: 1, changeRemarks: 1 }
        ).lean();

        const wkLogIds = weekConfirmations.map((c: any) => c.messageLogId);

        // If no confirmations found via scheduleDate, also try querying MessageLog directly
        // (handles older records that may not have scheduleDate on ScheduleConfirmation)
        let latestLogs: any[];

        if (wkLogIds.length === 0 && targetScheduleDate) {
          // Fallback: query MessageLog by scheduleDate directly
          const logMatch: any = { messageType: filter, scheduleDate: { $regex: new RegExp("^" + targetScheduleDate) } };
          latestLogs = await MessageLog.aggregate([
            { $match: logMatch },
            { $sort: { sentAt: -1 } },
            {
              $group: {
                _id: "$toNumber",
                status: { $first: "$status" },
                sentAt: { $first: "$sentAt" },
                messageLogId: { $first: "$_id" },
              }
            },
          ]);

          if (latestLogs.length === 0) {
            return { logMap: {} as Record<string, any>, confirmMap: {} as Record<string, any> };
          }

          // Look up confirmations for these specific log IDs
          const fallbackLogIds = latestLogs.map((l: any) => l.messageLogId);
          const fallbackConfirmations = await ScheduleConfirmation.find(
            { messageLogId: { $in: fallbackLogIds } },
            { messageLogId: 1, status: 1, changeRemarks: 1 }
          ).lean();

          const confirmMap: Record<string, any> = {};
          fallbackConfirmations.forEach((c: any) => {
            confirmMap[c.messageLogId.toString()] = c;
          });

          const logMap: Record<string, any> = {};
          latestLogs.forEach((log: any) => {
            const confirmation = confirmMap[log.messageLogId.toString()];
            let finalStatus = log.status;
            let changeRemarks = "";
            if (confirmation?.status === "confirmed") finalStatus = "confirmed";
            else if (confirmation?.status === "change_requested") {
              finalStatus = "change_requested";
              changeRemarks = confirmation.changeRemarks || "";
            }
            logMap[log._id] = {
              status: finalStatus,
              createdAt: log.sentAt?.toISOString?.() || log.sentAt,
              ...(changeRemarks ? { changeRemarks } : {}),
            };
          });

          return { logMap, confirmMap };
        }

        if (wkLogIds.length === 0) {
          return { logMap: {} as Record<string, any>, confirmMap: {} as Record<string, any> };
        }

        // Step 2: Get latest log per phone — scoped to week's messageLogIds
        latestLogs = await MessageLog.aggregate([
          { $match: { _id: { $in: wkLogIds }, messageType: filter } },
          { $sort: { sentAt: -1 } },
          {
            $group: {
              _id: "$toNumber",
              status: { $first: "$status" },
              sentAt: { $first: "$sentAt" },
              messageLogId: { $first: "$_id" },
            }
          },
        ]);

        // Build confirmation map from the already-fetched confirmations
        const confirmMap: Record<string, any> = {};
        weekConfirmations.forEach((c: any) => {
          confirmMap[c.messageLogId.toString()] = c;
        });

        // Build log map keyed by phone number
        const logMap: Record<string, any> = {};
        latestLogs.forEach((log: any) => {
          const confirmation = confirmMap[log.messageLogId.toString()];
          let finalStatus = log.status;
          let changeRemarks = "";
          if (confirmation?.status === "confirmed") finalStatus = "confirmed";
          else if (confirmation?.status === "change_requested") {
            finalStatus = "change_requested";
            changeRemarks = confirmation.changeRemarks || "";
          }
          logMap[log._id] = {
            status: finalStatus,
            createdAt: log.sentAt?.toISOString?.() || log.sentAt,
            ...(changeRemarks ? { changeRemarks } : {}),
          };
        });

        return { logMap, confirmMap };
      })()
      : Promise.resolve({ logMap: {} as Record<string, any>, confirmMap: {} as Record<string, any> });

    const [employees, schedules, routes, { logMap: messageLogStatusMap }, routeTypesList] = await Promise.all([
      employeePromise,
      schedulePromise,
      routePromise,
      messagingStatusPromise,
      routeTypePromise,
    ]);

    // Build lookup maps from RouteType: typeId → { name, partOf, routeStatus } and name.lower → same
    const typeIdToMeta = new Map<string, { name: string; partOf: string[]; routeStatus: string }>();
    const typeNameToMeta = new Map<string, { name: string; partOf: string[]; routeStatus: string }>();
    (routeTypesList as any[]).forEach((rt: any) => {
      const meta = {
        name: rt.name || "",
        partOf: Array.isArray(rt.partOf) ? rt.partOf : [],
        routeStatus: (rt.routeStatus || "").trim().toLowerCase(),
      };
      typeIdToMeta.set(String(rt._id), meta);
      if (rt.name) typeNameToMeta.set((rt.name as string).trim().toLowerCase(), meta);
    });

    // Resolve RouteType name from schedule (typeId → name, fallback to stored type string)
    const resolveScheduleType = (s: any): string => {
      if (s?.typeId) {
        const meta = typeIdToMeta.get(String(s.typeId));
        if (meta?.name) return meta.name;
      }
      return s?.type || "";
    };

    // Resolve RouteType meta for a schedule entry (typeId first, then type name)
    const resolveRTMeta = (s: any) => {
      if (s?.typeId) return typeIdToMeta.get(String(s.typeId));
      if (s?.type)   return typeNameToMeta.get((s.type as string).trim().toLowerCase());
      return undefined;
    };

    // isShiftType: RouteType must have "Shift" in partOf
    const isShiftType = (s: any): boolean => {
      const meta = resolveRTMeta(s);
      if (!meta) return false;
      return meta.partOf.includes("Shift");
    };

    // isRouteItineraryType: RouteType must have "Route Itinerary" in partOf
    const isRouteItineraryType = (s: any): boolean => {
      const meta = resolveRTMeta(s);
      if (!meta) return false;
      return meta.partOf.includes("Route Itinerary");
    };

    // isWeekScheduleType: RouteType must have "Week Schedule" in partOf
    const isWeekScheduleType = (s: any): boolean => {
      const meta = resolveRTMeta(s);
      if (!meta) return false;
      return meta.partOf.includes("Week Schedule");
    };

    // isNonOff: RouteType routeStatus must not be "off" (covers Scheduled, Pending, etc.)
    // Falls back to stored schedule routeStatus if no RouteType config found
    const isNonOff = (s: any): boolean => {
      const meta = resolveRTMeta(s);
      if (meta) return meta.routeStatus !== "off";
      // Legacy fallback: trust stored routeStatus
      return (s?.routeStatus || "").trim().toLowerCase() !== "off";
    };

    if (!yearWeek && !date) {
      return NextResponse.json({
        employees: employees.map((emp: any) => ({
          _id: emp._id,
          name: `${emp.firstName} ${emp.lastName}`.toUpperCase(),
          firstName: emp.firstName,
          lastName: emp.lastName,
          transporterId: emp.transporterId,
          phoneNumber: emp.phoneNumber,
          type: emp.type || "Unassigned",
          email: emp.email,
        })),
      });
    }

    // Map schedules by transporterId
    const scheduleMap: Record<string, any[]> = {};
    if (schedules) {
      schedules.forEach((s: any) => {
        if (!scheduleMap[s.transporterId]) scheduleMap[s.transporterId] = [];
        scheduleMap[s.transporterId].push(s);
      });
    }

    const routeMap: Record<string, any> = {};
    if (routes) {
      routes.forEach((r: any) => {
        const dStr = r.date instanceof Date ? r.date.toISOString().split("T")[0] : new Date(r.date.toString()).toISOString().split("T")[0];
        routeMap[`${r.transporterId}_${dStr}`] = r;
      });
    }

    // Merge employee data with schedule data + messaging statuses
    // Only include employees who have schedule records AND deduplicate by transporterId
    // This matches the scheduling grid which starts from schedule records
    const scheduledTransporterIds = new Set(Object.keys(scheduleMap));
    const seenTransporterIds = new Set<string>();
    const uniqueEmployees = employees.filter((emp: any) => {
      if (!emp.transporterId) return false;
      if (seenTransporterIds.has(emp.transporterId)) return false;
      // For flyer tab, include all employees regardless of schedule
      if (filter !== "flyer" && !scheduledTransporterIds.has(emp.transporterId)) return false;
      seenTransporterIds.add(emp.transporterId);
      return true;
    });
    const enrichedEmployees = uniqueEmployees.map((emp: any) => {
      const empSchedules = scheduleMap[emp.transporterId] || [];
      const normalizedPhone = emp.phoneNumber.startsWith("+") ? emp.phoneNumber : `+1${emp.phoneNumber.replace(/\D/g, "")}`;

      // Get messaging status from MessageLog (source of truth)
      const messagingStatus: Record<string, { status: string; createdAt: string } | null> = {};
      if (filter) {
        messagingStatus[filter] = messageLogStatusMap[normalizedPhone] || null;
      }

      return {
        _id: emp._id,
        name: `${emp.firstName} ${emp.lastName}`.toUpperCase(),
        firstName: emp.firstName,
        lastName: emp.lastName,
        transporterId: emp.transporterId,
        phoneNumber: emp.phoneNumber,
        type: emp.type || "Unassigned",
        email: emp.email,
        messagingStatus,
        schedules: empSchedules.map((s: any) => {
          const sDateKey = s.date instanceof Date ? s.date.toISOString().split("T")[0] : new Date(s.date.toString()).toISOString().split("T")[0];
          const routeInfo = routeMap[`${emp.transporterId}_${sDateKey}`] || {};
          
          return {
            date: s.date,
            weekDay: s.weekDay,
            typeId: s.typeId ? String(s.typeId) : "",
            scheduleType: resolveScheduleType(s),  // resolved from typeId → RouteType name
            type: s.type || "",                     // legacy fallback
            subType: s.subType || "",
            status: s.status || "",
            routeStatus: s.routeStatus || "",
            startTime: s.startTime || "",
            van: routeInfo.van || s.van || "",
            routeNumber: routeInfo.routeNumber || "",
            stagingLocation: routeInfo.stagingLocation || "",
            pad: routeInfo.pad || "",
            waveTime: routeInfo.waveTime || "",
          };
        }),
      };
    });

    // ── isScheduled kept for off-tomorrow logic (checks stored value) ──
    const isScheduled = (s: any) => (s?.routeStatus || "").trim().toLowerCase() === "scheduled";

    // Apply filters
    let filtered = enrichedEmployees;

    if (filter === "future-shift") {
      // Employees scheduled on the target date with a Shift-tagged RouteType (non-Off)
      const targetDate = date || getTomorrowPacific();
      filtered = enrichedEmployees.filter((emp: any) =>
        emp.schedules.some(
          (s: any) => toPacificDate(s.date) === targetDate && isNonOff(s) && isShiftType(s)
        )
      );
    } else if (filter === "shift") {
      // Employees scheduled on the target date with a Shift-tagged RouteType (non-Off)
      const targetDate = date || getTodayPacific();
      filtered = enrichedEmployees.filter((emp: any) =>
        emp.schedules.some(
          (s: any) => toPacificDate(s.date) === targetDate && isNonOff(s) && isShiftType(s)
        )
      );
    } else if (filter === "off-tomorrow") {
      // Today (selectedDate / targetDate) must be Off (routeStatus=off from RouteType) with Shift partOf
      // Tomorrow (targetDate + 1) must be non-Off with Shift partOf
      const todayDate = date || getTodayPacific();
      const tomorrowDate = (() => {
        const d = new Date(todayDate + "T12:00:00.000Z");
        d.setUTCDate(d.getUTCDate() + 1);
        return d.toISOString().split("T")[0];
      })();

      // isOff: RouteType routeStatus is "off" — or no schedule at all for that day
      const isOff = (s: any): boolean => {
        if (!s) return true; // no schedule = off
        const meta = resolveRTMeta(s);
        if (meta) return meta.routeStatus === "off";
        return (s?.routeStatus || "").trim().toLowerCase() === "off";
      };

      filtered = enrichedEmployees.filter((emp: any) => {
        const todaySchedule = emp.schedules.find(
          (s: any) => toPacificDate(s.date) === todayDate
        );
        const tomorrowSchedule = emp.schedules.find(
          (s: any) => toPacificDate(s.date) === tomorrowDate
        );

        // Today must be Off: no schedule for today, or RouteType routeStatus = "off"
        const todayIsOff = !todaySchedule || isOff(todaySchedule);

        // Tomorrow must be scheduled (non-Off) AND Shift partOf
        const tomorrowIsWorking = tomorrowSchedule && isNonOff(tomorrowSchedule) && isShiftType(tomorrowSchedule);

        return todayIsOff && tomorrowIsWorking;
      });
    } else if (filter === "week-schedule") {
      // Employees with at least one day this week where typeId.partOf includes "Week Schedule" AND non-Off
      filtered = enrichedEmployees.filter((emp: any) =>
        emp.schedules.some((s: any) => isNonOff(s) && isWeekScheduleType(s))
      );
    } else if (filter === "route-itinerary") {
      // Employees with a non-Off RouteType where partOf includes "Route Itinerary" on the target date
      const targetDate = date || getTodayPacific();
      filtered = enrichedEmployees.filter((emp: any) =>
        emp.schedules.some(
          (s: any) => toPacificDate(s.date) === targetDate && isNonOff(s) && isRouteItineraryType(s)
        )
      );
    } else if (filter === "flyer") {
      // All active employees — no schedule filter
      filtered = enrichedEmployees;
    }

    return NextResponse.json({
      employees: filtered,
      total: filtered.length,
    });
  } catch (error: any) {
    console.error("Messaging Employees API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
