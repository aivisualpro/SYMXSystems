import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxEmployee from "@/lib/models/SymxEmployee";
import ScheduleAuditLog from "@/lib/models/ScheduleAuditLog";
import SymxUser from "@/lib/models/SymxUser";
import SYMXRoute from "@/lib/models/SYMXRoute";

const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Resolve performer name from session, with DB fallback
async function resolvePerformerName(session: any): Promise<{ email: string; name: string }> {
  const email = session?.email || "unknown";
  const sessionName = session?.name || "";
  // If session has a proper name (not empty and not matching a role pattern), use it
  if (sessionName && sessionName.length > 1) {
    return { email, name: sessionName };
  }
  // Fallback: look up the user from DB
  try {
    const user = await SymxUser.findOne({ email: email.toLowerCase() }, { name: 1 }).lean() as any;
    if (user?.name) {
      return { email, name: user.name };
    }
  } catch { }
  return { email, name: email };
}

// Cache for weeksList
let weeksListCache: { data: string[]; timestamp: number } | null = null;
const WEEKS_CACHE_TTL = 60 * 1000; // 1 minute

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const yearWeek = searchParams.get("yearWeek");
    const weeksList = searchParams.get("weeksList");

    await connectToDatabase();

    // Return all available weeks for the dropdown (cached)
    if (weeksList === "true") {
      const now = Date.now();
      if (weeksListCache && (now - weeksListCache.timestamp) < WEEKS_CACHE_TTL) {
        return NextResponse.json({ weeks: weeksListCache.data });
      }
      const weeks = await SymxEmployeeSchedule.distinct("yearWeek");
      weeks.sort((a: string, b: string) => b.localeCompare(a));
      weeksListCache = { data: weeks, timestamp: Date.now() };
      return NextResponse.json({ weeks });
    }

    if (!yearWeek) {
      return NextResponse.json({ error: "yearWeek parameter is required" }, { status: 400 });
    }

    // Fetch all schedule entries for this week
    const schedules = await SymxEmployeeSchedule.find(
      { yearWeek },
      { transporterId: 1, date: 1, weekDay: 1, status: 1, type: 1, subType: 1, trainingDay: 1, startTime: 1, dayBeforeConfirmation: 1, dayOfConfirmation: 1, weekConfirmation: 1, van: 1, note: 1 }
    )
      .sort({ date: 1 })
      .lean();

    // Get unique transporter IDs
    const transporterIds = [...new Set(schedules.map((s: any) => s.transporterId))];

    // ── Run employee lookup, prev-week fetch, and audit counts IN PARALLEL ──
    const weekMatch = yearWeek.match(/(\d{4})-W(\d{2})/);
    let prevYearWeek = "";
    if (weekMatch) {
      const yr = parseInt(weekMatch[1]);
      const wk = parseInt(weekMatch[2]);
      let prevYr = yr, prevWk = wk - 1;
      if (prevWk <= 0) { prevYr--; prevWk = 52; }
      prevYearWeek = `${prevYr}-W${String(prevWk).padStart(2, "0")}`;
    }

    const [employees, prevSchedules, auditCountsRaw] = await Promise.all([
      // Employee info
      SymxEmployee.find(
        { transporterId: { $in: transporterIds } },
        { _id: 1, transporterId: 1, firstName: 1, lastName: 1, type: 1, status: 1, ScheduleNotes: 1, sunday: 1, monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 1, hiredDate: 1 }
      ).lean(),
      // Previous week schedules (only need date, transporterId, status)
      prevYearWeek
        ? SymxEmployeeSchedule.find(
          { yearWeek: prevYearWeek, transporterId: { $in: transporterIds } },
          { transporterId: 1, date: 1, status: 1 }
        ).lean()
        : Promise.resolve([]),
      // Audit counts
      ScheduleAuditLog.aggregate([
        { $match: { yearWeek } },
        { $group: { _id: "$transporterId", count: { $sum: 1 } } },
      ]),
    ]);

    const employeeMap = new Map(employees.map((emp: any) => [emp.transporterId, emp]));

    // Group schedules by transporter → days of week
    const grouped: Record<string, any> = {};
    schedules.forEach((s: any) => {
      if (!grouped[s.transporterId]) {
        const emp = employeeMap.get(s.transporterId);
        grouped[s.transporterId] = {
          transporterId: s.transporterId,
          employee: emp
            ? {
              _id: emp._id,
              firstName: emp.firstName,
              lastName: emp.lastName,
              name: `${emp.firstName} ${emp.lastName}`.toUpperCase(),
              type: emp.type || '',
              status: emp.status || '',
              ScheduleNotes: emp.ScheduleNotes || '',
              hiredDate: emp.hiredDate || null,
            }
            : null,
          weekNote: '',
          days: {},
        };
      }
      const date = new Date(s.date);
      const dayIndex = date.getUTCDay();
      grouped[s.transporterId].days[dayIndex] = {
        _id: s._id,
        date: s.date,
        weekDay: s.weekDay,
        status: s.status,
        type: s.type,
        subType: s.subType,
        trainingDay: s.trainingDay,
        startTime: s.startTime,
        dayBeforeConfirmation: s.dayBeforeConfirmation,
        dayOfConfirmation: s.dayOfConfirmation,
        weekConfirmation: s.weekConfirmation,
        van: s.van,
        note: s.note,
      };
      if (s.note && !grouped[s.transporterId].weekNote) {
        grouped[s.transporterId].weekNote = s.note;
      }
    });

    // Get the date range for the week
    const dates: string[] = [];
    if (schedules.length > 0) {
      const firstDate = new Date(schedules[0].date);
      const dayOfWeek = firstDate.getUTCDay();
      const sunday = new Date(firstDate);
      sunday.setUTCDate(firstDate.getUTCDate() - dayOfWeek);
      for (let i = 0; i < 7; i++) {
        const d = new Date(sunday);
        d.setUTCDate(sunday.getUTCDate() + i);
        dates.push(d.toISOString().split('T')[0]);
      }
    }

    // Compute previous week trailing consecutive "Scheduled" days
    const prevWeekTrailing: Record<string, number> = {};
    if (prevSchedules.length > 0) {
      const prevGrouped: Record<string, Record<number, string>> = {};
      prevSchedules.forEach((s: any) => {
        if (!prevGrouped[s.transporterId]) prevGrouped[s.transporterId] = {};
        const dayIndex = new Date(s.date).getUTCDay();
        prevGrouped[s.transporterId][dayIndex] = (s.status || "").trim().toLowerCase();
      });

      for (const tid of transporterIds as string[]) {
        const days = prevGrouped[tid];
        if (!days) continue;
        let count = 0;
        for (let d = 6; d >= 0; d--) {
          const status = days[d] || "";
          if (status !== "scheduled") break;
          count++;
        }
        if (count > 0) prevWeekTrailing[tid] = count;
      }
    }

    // Build audit counts map
    const auditCounts: Record<string, number> = {};
    auditCountsRaw.forEach((c: any) => { auditCounts[c._id] = c.count; });

    return NextResponse.json({
      yearWeek,
      dates,
      employees: Object.values(grouped),
      totalEmployees: Object.keys(grouped).length,
      prevWeekTrailing,
      auditCounts,
    });
  } catch (error: any) {
    console.error("Schedules API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Resolve performer name once for all audit entries in this request
    const performer = await resolvePerformerName(session);

    const body = await req.json();
    const { scheduleId, type, employeeId, note, startTime, status } = body;

    // Update employee global note (ScheduleNotes)
    if (employeeId && note !== undefined) {
      const { transporterId: noteTransporterId, employeeName: noteName, oldNote } = body;
      
      const updated = await SymxEmployee.findByIdAndUpdate(
        employeeId,
        { $set: { ScheduleNotes: note } },
        { new: true }
      ).lean() as any;

      if (!updated) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      }

      // Audit log (Record globally under 'Global' yearWeek)
      if (noteTransporterId) {
        await ScheduleAuditLog.create({
          yearWeek: "Global",
          transporterId: noteTransporterId,
          employeeName: noteName || `${updated.firstName} ${updated.lastName}`,
          action: "note_updated",
          field: "ScheduleNotes",
          oldValue: oldNote || "",
          newValue: note,
          performedBy: performer.email,
          performedByName: performer.name,
        });
      }

      return NextResponse.json({ success: true, employee: updated });
    }

    // Update schedule entry type
    if (scheduleId) {
      // Fetch existing record BEFORE update (for audit old values)
      const existing = await SymxEmployeeSchedule.findById(scheduleId).lean() as any;

      const newType = (type || "").trim().toLowerCase();
      const updateFields: Record<string, any> = { type: type || "" };
      if (status !== undefined) {
        updateFields.status = status;
      } else {
        const isWorking = !["off", "", "call out", "request off", "suspension", "stand by"].includes(newType);
        updateFields.status = isWorking ? "Scheduled" : "Off";
      }
      if (startTime !== undefined) updateFields.startTime = startTime;

      const updated = await SymxEmployeeSchedule.findByIdAndUpdate(
        scheduleId,
        { $set: updateFields },
        { new: true }
      ).lean() as any;

      if (!updated) {
        return NextResponse.json({ error: "Schedule entry not found" }, { status: 404 });
      }

      // Audit log — type change
      const oldType = existing?.type || "";
      const typeChanged = oldType !== (type || "");
      if (typeChanged) {
        const dateObj = updated.date ? new Date(updated.date) : null;
        const dayName = dateObj ? FULL_DAY_NAMES[dateObj.getUTCDay()] : "";
        // Try to get employee name
        const empName = body.employeeName || "";
        // If startTime also changed as part of this type change, include it in the same log
        const startTimeAlsoChanged = startTime !== undefined && existing?.startTime !== startTime;
        await ScheduleAuditLog.create({
          yearWeek: updated.yearWeek || "",
          transporterId: updated.transporterId,
          employeeName: empName,
          action: "type_changed",
          field: "type",
          oldValue: oldType,
          newValue: (type || "") + (startTimeAlsoChanged ? ` (${startTime})` : ""),
          date: updated.date,
          dayOfWeek: dayName,
          performedBy: performer.email,
          performedByName: performer.name,
        });
      }

      // Audit log — startTime change (only when type did NOT also change — avoids duplicate)
      if (!typeChanged && startTime !== undefined && existing?.startTime !== startTime) {
        const dateObj = updated.date ? new Date(updated.date) : null;
        const dayName = dateObj ? FULL_DAY_NAMES[dateObj.getUTCDay()] : "";
        await ScheduleAuditLog.create({
          yearWeek: updated.yearWeek || "",
          transporterId: updated.transporterId,
          employeeName: body.employeeName || "",
          action: "start_time_changed",
          field: "startTime",
          oldValue: existing?.startTime || "",
          newValue: startTime,
          date: updated.date,
          dayOfWeek: dayName,
          performedBy: performer.email,
          performedByName: performer.name,
        });
      }

      // Sync type to SYMXRoute (dispatching)
      if (typeChanged) {
        const newTypeNorm = (type || "").trim().toLowerCase();
        const isNowWorking = status ? (status !== "Off") : !["off", "", "call out", "request off", "suspension", "stand by"].includes(newTypeNorm);

        if (isNowWorking) {
          // Working type → upsert a route record (create if it doesn't exist)
          await SYMXRoute.updateOne(
            { transporterId: updated.transporterId, date: updated.date },
            {
              $set: {
                scheduleId: scheduleId,
                type: type || "",
                subType: updated.subType || "",
                weekDay: updated.weekDay || "",
                yearWeek: updated.yearWeek || "",
                van: updated.van || "",
              },
            },
            { upsert: true }
          ).catch(() => { }); // silent
        } else {
          // Off/empty type → remove route record so it disappears from dispatching
          await SYMXRoute.deleteOne(
            { transporterId: updated.transporterId, date: updated.date }
          ).catch(() => { }); // silent
        }
      }

      return NextResponse.json({ success: true, schedule: updated });
    }

    // Create new schedule entry if no scheduleId but transporterId + date provided
    const { transporterId, date, yearWeek, weekDay } = body;
    if (transporterId && date && yearWeek) {
      const created = await SymxEmployeeSchedule.findOneAndUpdate(
        { transporterId, date: new Date(date) },
        {
          $set: {
            type: type || "",
            yearWeek,
            weekDay: weekDay || "",
            status: status || "Scheduled",
            ...(startTime !== undefined ? { startTime } : {}),
          },
          $setOnInsert: {
            transporterId,
            date: new Date(date),
          },
        },
        { upsert: true, new: true }
      ).lean();

      // Audit log — schedule created/updated
      const dateObj = new Date(date);
      const dayName = FULL_DAY_NAMES[dateObj.getUTCDay()] || weekDay || "";
      await ScheduleAuditLog.create({
        yearWeek,
        transporterId,
        employeeName: body.employeeName || "",
        action: "schedule_created",
        field: "type",
        oldValue: "",
        newValue: type || "",
        date: new Date(date),
        dayOfWeek: dayName,
        performedBy: performer.email,
        performedByName: performer.name,
      });

      // Sync to SYMXRoute — only create for working types
      if (created && (created as any)._id) {
        const newTypeNorm = (type || "").trim().toLowerCase();
        const isWorking = status ? (status !== "Off") : !["off", "", "call out", "request off", "suspension", "stand by"].includes(newTypeNorm);

        if (isWorking) {
          await SYMXRoute.updateOne(
            { transporterId, date: new Date(date) },
            {
              $set: {
                scheduleId: (created as any)._id,
                type: type || "",
                weekDay: weekDay || "",
                yearWeek,
              },
            },
            { upsert: true }
          ).catch(() => { }); // silent
        } else {
          await SYMXRoute.deleteOne(
            { transporterId, date: new Date(date) }
          ).catch(() => { }); // silent
        }
      }

      return NextResponse.json({ success: true, schedule: created });
    }

    return NextResponse.json({ error: "scheduleId or transporterId+date+yearWeek is required" }, { status: 400 });
  } catch (error: any) {
    console.error("Schedule PATCH Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
