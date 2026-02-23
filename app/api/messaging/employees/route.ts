import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployee from "@/lib/models/SymxEmployee";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter"); // future-shift, shift, off-tomorrow, week-schedule, route-itinerary
    const yearWeek = searchParams.get("yearWeek");
    const date = searchParams.get("date"); // specific date for filtering

    await connectToDatabase();

    // Base: get all active employees with phone numbers
    const employees = await SymxEmployee.find(
      { status: "Active", phoneNumber: { $exists: true, $ne: "" } },
      {
        _id: 1,
        firstName: 1,
        lastName: 1,
        transporterId: 1,
        phoneNumber: 1,
        type: 1,
        status: 1,
        email: 1,
      }
    )
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    if (!yearWeek && !date) {
      // Return just employees list
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

    // Fetch schedules for the week
    const scheduleQuery: any = {};
    if (yearWeek) scheduleQuery.yearWeek = yearWeek;

    const schedules = await SymxEmployeeSchedule.find(scheduleQuery)
      .sort({ date: 1 })
      .lean();

    // Map schedules by transporterId
    const scheduleMap: Record<string, any[]> = {};
    schedules.forEach((s: any) => {
      if (!scheduleMap[s.transporterId]) scheduleMap[s.transporterId] = [];
      scheduleMap[s.transporterId].push(s);
    });

    // Merge employee data with schedule data
    const enrichedEmployees = employees.map((emp: any) => {
      const empSchedules = scheduleMap[emp.transporterId] || [];
      return {
        _id: emp._id,
        name: `${emp.firstName} ${emp.lastName}`.toUpperCase(),
        firstName: emp.firstName,
        lastName: emp.lastName,
        transporterId: emp.transporterId,
        phoneNumber: emp.phoneNumber,
        type: emp.type || "Unassigned",
        email: emp.email,
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
      // Employees with future scheduled shifts
      const now = new Date();
      filtered = enrichedEmployees.filter((emp: any) =>
        emp.schedules.some(
          (s: any) =>
            new Date(s.date) > now &&
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
      // Off today but scheduled tomorrow
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

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
