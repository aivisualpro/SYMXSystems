/**
 * Maps messaging panel tab ID → SymxEmployeeSchedule field name
 * Used by send route and webhook to know which messaging status array to update.
 */
export const TAB_TO_SCHEDULE_FIELD: Record<string, string> = {
    "future-shift": "futureShift",
    "shift": "shiftNotification",
    "off-tomorrow": "offTodayScheduleTom",
    "week-schedule": "weekSchedule",
    "route-itinerary": "routeItinerary",
};
