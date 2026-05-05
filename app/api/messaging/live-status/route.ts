import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import SymxEmployeeSchedule from "@/lib/models/SymxEmployeeSchedule";
import SymxEmployee from "@/lib/models/SymxEmployee";
import { TAB_TO_SCHEDULE_FIELD } from "@/lib/messaging-constants";

/**
 * Lightweight polling endpoint for live message status updates.
 * Reads from shiftNotification/futureShift/routeItinerary arrays in
 * SYMXEmployeeSchedules (single source of truth).
 *
 * Accepts: messageType, phones (comma-separated), yearWeek (optional), scheduleDate (optional)
 * Returns: { statuses: { [phone]: { status, createdAt, changeRemarks? } } }
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const messageType = searchParams.get("messageType") || "";
    const phones = searchParams.get("phones")?.split(",").filter(Boolean) || [];
    const yearWeek = searchParams.get("yearWeek") || "";
    const scheduleDate = searchParams.get("scheduleDate") || "";

    if (!messageType || phones.length === 0) {
      return NextResponse.json({ statuses: {} });
    }

    await connectToDatabase();

    const scheduleField = TAB_TO_SCHEDULE_FIELD[messageType];
    if (!scheduleField) {
      // messageType not mapped to a schedule field (e.g. week-schedule)
      return NextResponse.json({ statuses: {} });
    }

    // Resolve phone numbers → transporterIds
    // Strip country codes and normalize for lookup
    const normalizedPhones = phones.map(p => {
      const digits = p.replace(/\D/g, "");
      return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    });

    // Fetch employees with these phone numbers
    const phoneRegexes = normalizedPhones.map(p => new RegExp(p.replace(/\D/g, "") + "$"));
    const employees = await SymxEmployee.find(
      { phoneNumber: { $in: phoneRegexes } },
      { transporterId: 1, phoneNumber: 1 }
    ).lean() as any[];

    if (employees.length === 0) {
      return NextResponse.json({ statuses: {} });
    }

    // Build phone → transporterId map
    const phoneToTid: Record<string, string> = {};
    const tidToPhone: Record<string, string> = {};
    employees.forEach((emp: any) => {
      const empDigits = (emp.phoneNumber || "").replace(/\D/g, "");
      const empNorm = empDigits.length === 11 && empDigits.startsWith("1") ? empDigits.slice(1) : empDigits;
      // Match against the original phones list
      for (let i = 0; i < normalizedPhones.length; i++) {
        if (empNorm === normalizedPhones[i] || empDigits === normalizedPhones[i]) {
          phoneToTid[phones[i]] = emp.transporterId;
          tidToPhone[emp.transporterId] = phones[i];
          break;
        }
      }
    });

    const transporterIds = Object.values(phoneToTid);
    if (transporterIds.length === 0) {
      return NextResponse.json({ statuses: {} });
    }

    // Query schedules for these employees
    const scheduleQuery: any = { transporterId: { $in: transporterIds } };
    if (scheduleDate) {
      scheduleQuery.date = new Date(scheduleDate);
    } else if (yearWeek) {
      scheduleQuery.yearWeek = yearWeek;
    }

    const schedules = await SymxEmployeeSchedule.find(
      scheduleQuery,
      { transporterId: 1, [scheduleField]: 1 }
    ).lean() as any[];

    // Build status map from the schedule arrays
    const statuses: Record<string, { status: string; createdAt: string; changeRemarks?: string }> = {};

    schedules.forEach((sched: any) => {
      const phone = tidToPhone[sched.transporterId];
      if (!phone) return;

      const entries: any[] = Array.isArray(sched[scheduleField]) ? sched[scheduleField] : [];
      if (entries.length === 0) return;

      // Find the highest-priority status entry
      const statusPriority: Record<string, number> = {
        confirmed: 5, change_requested: 4, received: 3, delivered: 2, sent: 1, pending: 0,
      };

      let bestEntry = entries[entries.length - 1];
      let bestPriority = -1;
      for (const entry of entries) {
        const p = statusPriority[entry.status] ?? -1;
        if (p > bestPriority) {
          bestPriority = p;
          bestEntry = entry;
        }
      }

      statuses[phone] = {
        status: bestEntry.status || "pending",
        createdAt: bestEntry.createdAt?.toISOString?.() || bestEntry.createdAt || new Date().toISOString(),
        ...(bestEntry.changeRemarks ? { changeRemarks: bestEntry.changeRemarks } : {}),
      };
    });

    return NextResponse.json({ statuses });
  } catch (error: any) {
    console.error("Live status poll error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
