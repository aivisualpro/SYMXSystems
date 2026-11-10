// Message types and their built-in default wording. Shared by the Compose
// screen, station settings, and the server (nightly reset), so the wording
// and the variable names live in one place.
//
// A station can set its OWN default per type (Station settings → Default
// messages). Compose edits are per station and are reset to that station
// default every night at 11 PM Pacific.

export interface MessageTemplateDef {
  id: string;
  label: string;
  defaultMessage: string;
  variables: string[];
}

export const MESSAGE_TEMPLATE_DEFS: MessageTemplateDef[] = [
  {
    id: "shift",
    label: "Shift Notification",
    defaultMessage: "Hello {name}\n\n{dayOfWeek} {date}\n\nYou have a shift scheduled today @ {startTime}\n\nStand-up will be at {standupTime}\n\nPlease confirm here: {confirmationLink}\n\nThank you!",
    variables: ["name", "dayOfWeek", "date", "startTime", "standupTime", "confirmationLink"],
  },
  {
    id: "future-shift",
    label: "Future Shift Notification",
    defaultMessage: "Hello {name}\n\n{dayOfWeek} {date}\n\nYou are on schedule to work tomorrow @ {startTime}\n\nStand-up will be at {standupTime}\n\nPlease confirm here: {confirmationLink}\n\nSee you tomorrow!",
    variables: ["name", "dayOfWeek", "date", "startTime", "standupTime", "confirmationLink"],
  },
  {
    id: "route-itinerary",
    label: "Route Itinerary",
    defaultMessage: "Hello {name}\n\n{dayOfWeek} {date}\n\nYour route itinerary has been updated. Please review your assigned route for today.\nRoute: {routeNumber}\nVan: {van}\nStaging: {stagingLocation}\nPad: {pad}\nWave Time: {waveTime}\nFirst Stop Time: {firstStopTime} (be at your first stop by then)\n\nPlease confirm here: {confirmationLink}\n\nThank you!",
    variables: ["name", "dayOfWeek", "date", "van", "stagingLocation", "routeNumber", "pad", "waveTime", "firstStopTime", "confirmationLink"],
  },
  {
    id: "week-schedule",
    label: "Week Schedule",
    defaultMessage: "Hi {name}\n\nHere is your schedule for next week {yearWeek}\n----------------------\n\n{weekSchedule}\n\n----------------------\nPlease confirm here: {confirmationLink}\n\nPlease check your start times!",
    variables: ["name", "yearWeek", "weekSchedule", "confirmationLink"],
  },
  {
    id: "training-reminder",
    label: "Training Reminder",
    defaultMessage: "Hello {name}\n\nTraining Reminder\n\n{dayOfWeek} {date}\n\nYou have training tomorrow. Training starts at 8:00 AM.\n\nLocation: {trainingAddress}\n\nPlease arrive on time. Thank you!",
    variables: ["name", "dayOfWeek", "date", "trainingAddress"],
  },
  {
    id: "flyer",
    label: "Flyer",
    defaultMessage: "",
    variables: ["name"],
  },
  {
    id: "off-tomorrow",
    label: "Off Today - Schedule Tomorrow",
    defaultMessage: "Hello {name}\n\n{dayOfWeek} {date}\n\nYou are off today. Reminder: you are on schedule to work tomorrow @ {startTime}\n\nStand-up will be at {standupTime}\n\nPlease confirm here: {confirmationLink}\n\nSee you tomorrow!",
    variables: ["name", "dayOfWeek", "date", "startTime", "standupTime", "confirmationLink"],
  },
];

export const MESSAGE_TEMPLATE_TYPES = MESSAGE_TEMPLATE_DEFS.map((d) => d.id);

export const DEFAULT_MESSAGES: Record<string, string> = Object.fromEntries(
  MESSAGE_TEMPLATE_DEFS.map((d) => [d.id, d.defaultMessage])
);
