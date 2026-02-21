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
      // Find the Sunday of this week from the first schedule entry
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

    return NextResponse.json({
      yearWeek,
      dates,
      employees: Object.values(grouped),
      totalEmployees: Object.keys(grouped).length,
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
    const { scheduleId, type } = body;

    if (!scheduleId) {
      return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });
    }

    const updated = await SymxEmployeeSchedule.findByIdAndUpdate(
      scheduleId,
      { $set: { type: type || "" } },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Schedule entry not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, schedule: updated });
  } catch (error: any) {
    console.error("Schedule PATCH Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
