import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployee from "@/lib/models/SymxEmployee";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SYMXRoute from "@/lib/models/SYMXRoute";
import MessageLog from "@/lib/models/MessageLog";
import ScheduleConfirmation from "@/lib/models/ScheduleConfirmation";
import { TAB_TO_SCHEDULE_FIELD } from "@/lib/messaging-constants";

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

    // ── Detect cross-week boundary for future-shift ──
    // When today is Saturday (last day of the week), "tomorrow" is Sunday of the NEXT week.
    // We need to also fetch next week's schedules so the future-shift filter can find Sunday entries.
    let needsNextWeek = false;
    let nextYearWeek = "";
    if ((filter === "future-shift" || filter === "off-tomorrow") && yearWeek) {
      const tomorrowStr = getTomorrowPacific();
      const weekDates = getWeekDateStrings(yearWeek);
      // If tomorrow's date is NOT within the selected week's date range, we need next week's data
      if (weekDates.length > 0 && !weekDates.includes(tomorrowStr)) {
        needsNextWeek = true;
        nextYearWeek = getNextYearWeek(yearWeek);
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
    // If cross-week boundary detected, also fetch next week's schedules
    const scheduleQuery = yearWeek
      ? (needsNextWeek
        ? { yearWeek: { $in: [yearWeek, nextYearWeek] } }
        : { yearWeek })
      : null;
    const schedulePromise = scheduleQuery
      ? SymxEmployeeSchedule.find(
        scheduleQuery,
        { transporterId: 1, date: 1, weekDay: 1, type: 1, subType: 1, status: 1, startTime: 1, van: 1 }
      )
        .sort({ date: 1 })
        .lean()
      : Promise.resolve(null);

    const routeQuery = yearWeek
      ? (needsNextWeek
        ? { yearWeek: { $in: [yearWeek, nextYearWeek] } }
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
    const DATE_SPECIFIC_TABS = ["shift", "future-shift", "route-itinerary", "off-tomorrow"];
    let targetScheduleDate = "";
    if (filter && DATE_SPECIFIC_TABS.includes(filter)) {
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
          confirmQuery.scheduleDate = targetScheduleDate;
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
          const logMatch: any = { messageType: filter, scheduleDate: targetScheduleDate };
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

    const [employees, schedules, routes, { logMap: messageLogStatusMap }] = await Promise.all([
      employeePromise,
      schedulePromise,
      routePromise,
      messagingStatusPromise,
    ]);

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
    const enrichedEmployees = employees.map((emp: any) => {
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
            type: s.type || "",
            subType: s.subType || "",
            status: s.status || "",
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

    // Apply filters
    let filtered = enrichedEmployees;

    if (filter === "future-shift") {
      // Employees on Route specifically TOMORROW (Pacific Time)
      // Works across week boundaries: on Saturday (last day of W18), tomorrow is Sunday of W19
      const tomorrowStr = getTomorrowPacific();
      filtered = enrichedEmployees.filter((emp: any) =>
        emp.schedules.some(
          (s: any) =>
            toPacificDate(s.date) === tomorrowStr &&
            s.type &&
            ["route", "pending ecp"].includes(s.type.toLowerCase().trim())
        )
      );
    } else if (filter === "shift") {
      // Employees on Route specifically TODAY (Pacific Time)
      const todayStr = getTodayPacific();
      filtered = enrichedEmployees.filter((emp: any) =>
        emp.schedules.some(
          (s: any) =>
            toPacificDate(s.date) === todayStr &&
            s.type &&
            ["route", "pending ecp"].includes(s.type.toLowerCase().trim())
        )
      );
    } else if (filter === "off-tomorrow") {
      // Off today but scheduled tomorrow (Pacific Time)
      const todayStr = getTodayPacific();
      const tomorrowStr = getTomorrowPacific();

      filtered = enrichedEmployees.filter((emp: any) => {
        const todaySchedule = emp.schedules.find(
          (s: any) => toPacificDate(s.date) === todayStr
        );
        const tomorrowSchedule = emp.schedules.find(
          (s: any) => toPacificDate(s.date) === tomorrowStr
        );

        const isOffToday =
          !todaySchedule ||
          (todaySchedule.status && todaySchedule.status.toLowerCase().trim() === "off") ||
          (!todaySchedule.status && todaySchedule.type && ["off", "close", "request off", ""].includes(todaySchedule.type.toLowerCase().trim())) ||
          (!todaySchedule.status && !todaySchedule.type);

        const isWorkingTomorrow =
          tomorrowSchedule &&
          ((tomorrowSchedule.status && tomorrowSchedule.status.toLowerCase().trim() === "scheduled") ||
           (tomorrowSchedule.type && ["route", "pending ecp"].includes(tomorrowSchedule.type.toLowerCase().trim())));

        return isOffToday && isWorkingTomorrow;
      });
    } else if (filter === "week-schedule") {
      // Employees with at least one day this week where status = "Scheduled"
      // This matches the scheduling grid's day-count logic exactly
      filtered = enrichedEmployees.filter((emp: any) =>
        emp.schedules.some(
          (s: any) => (s.status || "").trim().toLowerCase() === "scheduled"
        )
      );
    } else if (filter === "route-itinerary") {
      // Employees on Route specifically TODAY (Pacific Time)
      const todayStr = getTodayPacific();
      filtered = enrichedEmployees.filter((emp: any) =>
        emp.schedules.some(
          (s: any) =>
            toPacificDate(s.date) === todayStr &&
            s.type &&
            ["route", "pending ecp"].includes(s.type.toLowerCase().trim())
        )
      );
    } else if (filter === "flyer") {
      // All active employees — no schedule filter, broadcast to everyone
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
