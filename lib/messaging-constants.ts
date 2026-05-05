/**
 * Maps messaging panel tab ID → SymxEmployeeSchedule field name
 * Used by send route and webhook to know which messaging status array to update.
 *
 * Arrays:
 *   shiftNotification  — shift messages
 *   futureShift        — future-shift AND off-tomorrow messages (merged)
 *   routeItinerary     — route-itinerary messages
 *   weekSchedule       — week-schedule (lives in SYMXScheduleConfirmations only)
 */
export const TAB_TO_SCHEDULE_FIELD: Record<string, string> = {
    "shift": "shiftNotification",
    "future-shift": "futureShift",
    "off-tomorrow": "futureShift",       // merged into futureShift
    "route-itinerary": "routeItinerary",
    // "week-schedule" — lives in SYMXScheduleConfirmations only, no schedule array
};
