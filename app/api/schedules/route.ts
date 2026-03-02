import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxEmployee from "@/lib/models/SymxEmployee";

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

    // Return all available weeks for the dropdown
    if (weeksList === "true") {
      const weeks = await SymxEmployeeSchedule.distinct("yearWeek");
      // Sort weeks descending
      weeks.sort((a: string, b: string) => b.localeCompare(a));
      return NextResponse.json({ weeks });
    }

    if (!yearWeek) {
      return NextResponse.json({ error: "yearWeek parameter is required" }, { status: 400 });
    }

    // Fetch all schedule entries for this week
    const schedules = await SymxEmployeeSchedule.find({ yearWeek })
      .sort({ date: 1 })
      .lean();

    // Get unique transporter IDs
    const transporterIds = [...new Set(schedules.map((s: any) => s.transporterId))];

    // Fetch employee info
    const employees = await SymxEmployee.find(
      { transporterId: { $in: transporterIds } },
      {
        _id: 1,
        transporterId: 1,
        firstName: 1,
        lastName: 1,
        type: 1,
        status: 1,
        ScheduleNotes: 1,
        sunday: 1,
        monday: 1,
        tuesday: 1,
        wednesday: 1,
        thursday: 1,
        friday: 1,
        saturday: 1,
      }
    ).lean();

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
              scheduleNotes: emp.ScheduleNotes || '',
            }
            : null,
          days: {},
        };
      }
      // Use day of week as key (0=Sun, 1=Mon, ..., 6=Sat)
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

    // ── Compute previous week's trailing consecutive "Scheduled" days ──
    // This allows cross-week detection of 6+ consecutive scheduled days
    const prevWeekTrailing: Record<string, number> = {};

    // Compute previous yearWeek string (e.g., "2026-W08" → "2026-W07")
    const weekMatch = yearWeek.match(/(\d{4})-W(\d{2})/);
    if (weekMatch) {
      const yr = parseInt(weekMatch[1]);
      const wk = parseInt(weekMatch[2]);
      let prevYr = yr, prevWk = wk - 1;
      if (prevWk <= 0) { prevYr--; prevWk = 52; }
      const prevYearWeek = `${prevYr}-W${String(prevWk).padStart(2, "0")}`;

      // Fetch previous week's schedules for the same employees
      const prevSchedules = await SymxEmployeeSchedule.find({
        yearWeek: prevYearWeek,
        transporterId: { $in: transporterIds },
      }).sort({ date: 1 }).lean();

      // Group prev week by transporter → days
      const prevGrouped: Record<string, Record<number, string>> = {};
      prevSchedules.forEach((s: any) => {
        if (!prevGrouped[s.transporterId]) prevGrouped[s.transporterId] = {};
        const dayIndex = new Date(s.date).getUTCDay();
        prevGrouped[s.transporterId][dayIndex] = (s.status || "").trim().toLowerCase();
      });

      // Count trailing consecutive working days from Saturday backwards
      for (const tid of transporterIds as string[]) {
        const days = prevGrouped[tid];
        if (!days) continue;
        let count = 0;
        for (let d = 6; d >= 0; d--) { // 6=Sat, 5=Fri, ...
          const status = days[d] || "";
          if (status !== "scheduled") break;
          count++;
        }
        if (count > 0) prevWeekTrailing[tid] = count;
      }
    }

    return NextResponse.json({
      yearWeek,
      dates,
      employees: Object.values(grouped),
      totalEmployees: Object.keys(grouped).length,
      prevWeekTrailing,
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

    const body = await req.json();
    const { scheduleId, type, employeeId, note } = body;

    // Update employee-level schedule notes
    if (employeeId && note !== undefined) {
      const updated = await SymxEmployee.findByIdAndUpdate(
        employeeId,
        { $set: { ScheduleNotes: note } },
        { new: true }
      ).lean();

      if (!updated) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, employee: updated });
    }

    // Update schedule entry type
    if (scheduleId) {
      const newType = (type || "").trim().toLowerCase();
      const isWorking = !["off", "close", "request off", ""].includes(newType);
      const updateFields: Record<string, any> = { type: type || "" };
      if (isWorking) updateFields.status = "Scheduled";

      const updated = await SymxEmployeeSchedule.findByIdAndUpdate(
        scheduleId,
        { $set: updateFields },
        { new: true }
      ).lean();

      if (!updated) {
        return NextResponse.json({ error: "Schedule entry not found" }, { status: 404 });
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
            status: "Scheduled",
          },
          $setOnInsert: {
            transporterId,
            date: new Date(date),
          },
        },
        { upsert: true, new: true }
      ).lean();

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
