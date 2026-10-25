/**
 * Maps messaging panel tab ID → SymxEmployeeSchedule field name
 * Used by send route and webhook to know which messaging status array to update.
 *
 * Arrays:
 *   shiftNotification  — shift messages
 *   futureShift        — future-shift AND off-tomorrow messages (merged)
 *   routeItinerary     — route-itinerary messages
 *   weekSchedule       — week-schedule (no schedule array, token-only in SYMXScheduleConfirmations)
 */
export const TAB_TO_SCHEDULE_FIELD: Record<string, string> = {
    "shift": "shiftNotification",
    "future-shift": "futureShift",
    "off-tomorrow": "futureShift",       // merged into futureShift
    "route-itinerary": "routeItinerary",
    "training-reminder": "trainingReminder",
    // "week-schedule" — uses SYMXScheduleConfirmations collection (not a schedule array)
};

/**
 * A message belongs to the day it was meant for. A schedule row can also hold
 * entries from OTHER days (a message sent early by mistake, and its confirmation);
 * those must not make this day look sent/confirmed. Keeps only entries created
 * (Pacific time) between `fromDay` and `toDay` inclusive (YYYY-MM-DD). The window
 * is usually the message day plus the next day, so a driver replying the next
 * morning still counts. Pass `toDay` omitted for a single day.
 */
export function entriesInWindow<T extends { createdAt?: any }>(entries: T[], fromDay: string, toDay?: string): T[] {
    if (!fromDay) return entries;
    const end = toDay || fromDay;
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" });
    return entries.filter((e) => {
        const d = e?.createdAt ? new Date(e.createdAt) : null;
        if (!d || isNaN(d.getTime())) return false;
        const day = fmt.format(d);
        return day >= fromDay && day <= end;
    });
}

/** YYYY-MM-DD plus/minus whole days. */
export function addDays(dayStr: string, n: number): string {
    const d = new Date(dayStr + "T12:00:00.000Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().split("T")[0];
}

/** Window of valid message days for a tab, given the schedule row's own day. */
export function messageWindowForTab(tab: string, rowDay: string): [string, string] {
    if (tab === "training-reminder") return [addDays(rowDay, -1), rowDay]; // sent the day before the training day
    return [rowDay, addDays(rowDay, 1)]; // sent that day; a reply the next morning still counts
}
