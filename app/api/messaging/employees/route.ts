import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployee from "@/lib/models/SymxEmployee";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
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

    // Run employee + schedule queries IN PARALLEL
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

    const [employees, schedules] = await Promise.all([employeePromise, schedulePromise]);

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

    // ── Fetch latest MessageLog status per employee for this tab ──
    // This is the source of truth (updated on confirmation/reply)
    const allPhones = employees.map((emp: any) => {
      const ph = emp.phoneNumber;
      return ph.startsWith("+") ? ph : `+1${ph.replace(/\D/g, "")}`;
    });

    let messageLogStatusMap: Record<string, { status: string; createdAt: string; changeRemarks?: string }> = {};
    if (filter) {
      let weekLogIdFilter: any = null;
      if (yearWeek) {
        const weekConfirmations = await ScheduleConfirmation.find(
          { yearWeek, messageType: filter, messageLogId: { $exists: true } },
          { messageLogId: 1 }
        ).lean();
        const wkLogIds = weekConfirmations.map((c: any) => c.messageLogId);
        weekLogIdFilter = wkLogIds.length > 0 ? { $in: wkLogIds } : null;
      }

      // Build match: by messageType + phone numbers, optionally scoped to week's messageLogIds
      const matchStage: any = { messageType: filter, toNumber: { $in: allPhones } };
      if (weekLogIdFilter) matchStage._id = weekLogIdFilter;

      const latestLogs = await MessageLog.aggregate([
        { $match: matchStage },
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

      // Also check for ScheduleConfirmation linked to these logs
      const logIds = latestLogs.map((l: any) => l.messageLogId);
      const confirmations = logIds.length > 0
        ? await ScheduleConfirmation
          .find({ messageLogId: { $in: logIds } }, { messageLogId: 1, status: 1, confirmedAt: 1, changeRequestedAt: 1, changeRemarks: 1 })
          .lean()
        : [];
      const confirmMap: Record<string, any> = {};
      confirmations.forEach((c: any) => {
        confirmMap[c.messageLogId.toString()] = c;
      });

      latestLogs.forEach((log: any) => {
        const confirmation = confirmMap[log.messageLogId.toString()];
        let finalStatus = log.status; // "sent", "delivered", "failed", "received_reply"
        let changeRemarks = "";
        if (confirmation?.status === "confirmed") finalStatus = "confirmed";
        else if (confirmation?.status === "change_requested") {
          finalStatus = "change_requested";
          changeRemarks = confirmation.changeRemarks || "";
        }
        messageLogStatusMap[log._id] = {
          status: finalStatus,
          createdAt: log.sentAt?.toISOString?.() || log.sentAt,
          ...(changeRemarks ? { changeRemarks } : {}),
        };
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
        schedules: empSchedules.map((s: any) => ({
          date: s.date,
          weekDay: s.weekDay,
          type: s.type || "",
          subType: s.subType || "",
          status: s.status || "",
          startTime: s.startTime || "",
          van: s.van || "",
        })),
      };
    });

    // Apply filters
    let filtered = enrichedEmployees;

    if (filter === "future-shift") {
      // Employees with future scheduled shifts (relative to Pacific today)
      const todayPacificDate = new Date(getTodayPacific() + "T00:00:00.000Z");
      filtered = enrichedEmployees.filter((emp: any) =>
        emp.schedules.some(
          (s: any) =>
            new Date(s.date) > todayPacificDate &&
            s.type &&
            !["off", "close", "request off", ""].includes(s.type.toLowerCase().trim())
        )
      );
    } else if (filter === "shift") {
      // Employees with any shift this week
      filtered = enrichedEmployees.filter((emp: any) =>
        emp.schedules.some(
          (s: any) =>
            s.type &&
            !["off", "close", "request off", ""].includes(s.type.toLowerCase().trim())
        )
      );
    } else if (filter === "off-tomorrow") {
      // Off today but scheduled tomorrow (Pacific Time)
      const todayStr = getTodayPacific();
      const tomorrowStr = getTomorrowPacific();

      filtered = enrichedEmployees.filter((emp: any) => {
        const todaySchedule = emp.schedules.find(
          (s: any) => new Date(s.date).toISOString().split("T")[0] === todayStr
        );
        const tomorrowSchedule = emp.schedules.find(
          (s: any) => new Date(s.date).toISOString().split("T")[0] === tomorrowStr
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
      // Only employees with at least one working day this week
      filtered = enrichedEmployees.filter((emp: any) =>
        emp.schedules.some(
          (s: any) =>
            s.type &&
            !["off", "close", "request off", ""].includes(s.type.toLowerCase().trim())
        )
      );
    } else if (filter === "route-itinerary") {
      // Employees with route type schedules
      filtered = enrichedEmployees.filter((emp: any) =>
        emp.schedules.some(
          (s: any) => s.type && s.type.toLowerCase().trim() === "route"
        )
      );
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
