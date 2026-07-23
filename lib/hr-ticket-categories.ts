// Shared HR Ticket category list — previously duplicated separately in the
// public submit-ticket form (app/submit-ticket/page.tsx) and the admin
// workbench (app/(protected)/hr/tickets/page.tsx). Both now import from here
// so adding/renaming a category only has to happen in one place.
export const HR_TICKET_CATEGORIES = [
  "Payroll Issue",
  "Schedule Change",
  "Benefits Question",
  "Leave Request",
  "Schedule a Meeting with Manager",
  "Equipment Issue",
  "Safety Concern",
  "Workplace Complaint",
  "Policy Question",
  "Training Request",
  "Other",
];

// Categories where the employee is asking for specific dates off — these get
// the date/date-range picker on the submission form instead of relying on
// whatever they typed into the free-text issue description. Kept as its own
// list (rather than a boolean on some bigger config object) since "Leave
// Request" is currently the only one, but this makes it easy to opt another
// category in later without touching the form logic itself.
export const HR_TICKET_TIME_OFF_CATEGORIES = ["Leave Request"];
