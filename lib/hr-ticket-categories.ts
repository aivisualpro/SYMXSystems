// Shared HR Ticket category list — previously duplicated separately in the
// public submit-ticket form (app/submit-ticket/page.tsx) and the admin
// workbench (app/(protected)/hr/tickets/page.tsx). Both now import from here
// so adding/renaming a category only has to happen in one place.
export const HR_TICKET_CATEGORIES = [
  "Request Time Off",
  "Payroll Issue",
  "Schedule Change",
  "Benefits Question",
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
// whatever they typed into the free-text issue description. "Leave Request"
// is kept here too (even though it's no longer offered as a choice on the
// form — renamed to "Request Time Off" above) so any existing tickets filed
// under the old name still get the date fields if an admin opens/edits them.
export const HR_TICKET_TIME_OFF_CATEGORIES = ["Request Time Off", "Leave Request"];
