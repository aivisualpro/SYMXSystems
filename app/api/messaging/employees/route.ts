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

    // ── Run all queries IN PARALLEL for maximum speed ──
    const employeePromise = SymxEmployee.find(
      { status: "Active", phoneNumber: { $exists: true, $ne: "" } },
      { _id: 1, firstName: 1, lastName: 1, transporterId: 1, phoneNumber: 1, type: 1, status: 1, email: 1 }
    )
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    // Schedule query with PROJECTION — only fetch fields we actually use
    const schedulePromise = yearWeek
      ? SymxEmployeeSchedule.find(
        { yearWeek },
        { transporterId: 1, date: 1, weekDay: 1, type: 1, subType: 1, status: 1, startTime: 1, van: 1 }
      )
        .sort({ date: 1 })
        .lean()
      : Promise.resolve(null);

    const routePromise = yearWeek
      ? SYMXRoute.find(
          { yearWeek },
          { transporterId: 1, date: 1, routeNumber: 1, stagingLocation: 1, pad: 1, waveTime: 1, van: 1 }
        ).lean()
      : Promise.resolve(null);

    // ── Messaging status — single optimized aggregation ──
    // Combines ScheduleConfirmation + MessageLog lookups into one pipeline
    const messagingStatusPromise = (filter && yearWeek)
      ? (async () => {
        // Step 1: Get messageLogIds scoped to this week+messageType
        const weekConfirmations = await ScheduleConfirmation.find(
          { yearWeek, messageType: filter, messageLogId: { $exists: true } },
          { messageLogId: 1, status: 1, changeRemarks: 1 }
        ).lean();

        const wkLogIds = weekConfirmations.map((c: any) => c.messageLogId);

        if (wkLogIds.length === 0) {
          return { logMap: {} as Record<string, any>, confirmMap: {} as Record<string, any> };
        }

        // Step 2: Get latest log per phone — scoped to week's messageLogIds
        const [latestLogs] = await Promise.all([
          MessageLog.aggregate([
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
          ]),
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
      const tomorrowStr = getTomorrowPacific();
      filtered = enrichedEmployees.filter((emp: any) =>
        emp.schedules.some(
          (s: any) =>
            toPacificDate(s.date) === tomorrowStr &&
            s.type &&
            s.type.toLowerCase().trim() === "route"
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
            s.type.toLowerCase().trim() === "route"
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
          !todaySchedule.type ||
          ["off", "close", "request off", ""].includes(todaySchedule.type.toLowerCase().trim());

        const isWorkingTomorrow =
          tomorrowSchedule &&
          tomorrowSchedule.type &&
          !["off", "close", "request off", ""].includes(tomorrowSchedule.type.toLowerCase().trim());

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
            s.type.toLowerCase().trim() === "route"
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
