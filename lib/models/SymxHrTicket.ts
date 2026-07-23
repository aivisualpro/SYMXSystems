import mongoose, { Schema, Document } from "mongoose";

// The real ticket lifecycle used by the admin workbench. approveDeny (below)
// is kept only for backward compatibility — the HR dashboard's pending/
// approved/denied counts (app/(protected)/hr/page.tsx) still read that raw
// string field directly, so every status transition through the workbench
// API keeps it in sync rather than migrating the dashboard too.
export type HrTicketStatus = "open" | "on_hold" | "approved" | "denied" | "closed";
export type HrTicketPriority = "low" | "normal" | "high";

export interface IHrTicketActivityEntry {
  // "note" = free text an HR person typed. "status_change" = system-
  // generated line for a lifecycle transition (approve/deny/hold/close/
  // reopen). "system" = other system-generated lines (link/unlink,
  // assignment changes). "created" = the opening entry every ticket gets.
  type: "note" | "status_change" | "system" | "created";
  text: string;
  byName?: string;
  byEmail?: string;
  createdAt: Date;
}

export interface ISymxHrTicket extends Document {
  ticketNumber?: string;
  transporterId?: string;
  // Links this ticket to a real SymxEmployee record. Either set manually
  // by whoever reviews the ticket in the admin Tickets workbench (via the
  // employee-link picker), or set automatically at submission time when
  // the submitter's name/email is an unambiguous exact match against a
  // SymxEmployee record (see employeeMatchType).
  employeeId?: mongoose.Types.ObjectId;
  // "auto" when employeeId was set by the exact-match logic in
  // matchEmployeeForTicket rather than a human — lets the admin UI show an
  // "Auto-matched" badge so it's clear the link wasn't manually confirmed.
  // Cleared (left undefined) once someone manually changes the link.
  employeeMatchType?: "auto" | "manual";
  // A same-signal-but-ambiguous or partial candidate found at submission
  // time (e.g. name/email matched more than one employee) — surfaced in
  // the admin UI as a one-click "confirm this match" suggestion rather
  // than applied automatically.
  suggestedEmployeeId?: mongoose.Types.ObjectId;
  category?: string;
  issue?: string;
  // Structured time-off request, captured for categories in
  // HR_TICKET_TIME_OFF_CATEGORIES (see lib/hr-ticket-categories.ts) instead
  // of relying on free-text dates buried in `issue`. A ticket holds exactly
  // ONE single day or ONE continuous range — never multiple disjoint dates —
  // by construction of the submission form, so scheduling can resolve each
  // request independently instead of a ticket sitting open waiting on the
  // furthest-out of several unrelated dates bundled together.
  timeOffDateType?: "single" | "range";
  timeOffStartDate?: Date;
  timeOffEndDate?: Date; // equals timeOffStartDate for "single"
  attachment?: string;
  managersEmail?: string;
  notes?: string;
  // Legacy field — see the comment above HrTicketStatus. New code should
  // read/write `status`, not this.
  approveDeny?: string;
  resolution?: string;
  holdReason?: string;
  closedDateTime?: Date;
  closedBy?: string;
  closedTicketSent?: string;
  createdBy?: string;
  status?: HrTicketStatus;
  priority?: HrTicketPriority;
  // Email of the HR staffer this ticket is assigned to. Free-form (not a
  // ref) since assignment is meant to be lightweight — anyone with an
  // email can be assigned, not just users with a full account record.
  assignedTo?: string;
  // Chronological case log: every note, status change, assignment change,
  // and link/unlink shows up here so a reviewer can see the full history
  // of a ticket in one place, the way an HCM case file would.
  activity?: IHrTicketActivityEntry[];
  // Which channel this ticket came in through — lets the admin UI
  // distinguish driver-submitted tickets from ones staff created directly.
  source?: "public" | "admin" | "import";
  // Explicit submitter identity fields, set by the public form. Kept
  // separate from managersEmail (which admins use for the ticket's
  // routing/manager contact) so the two don't collide.
  submitterName?: string;
  submitterEmail?: string;
  // Best-effort submitter IP, recorded only on public submissions for
  // lightweight abuse throttling/auditing — never shown in the UI.
  submitterIp?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const HrTicketActivitySchema = new Schema<IHrTicketActivityEntry>(
  {
    type: { type: String, enum: ["note", "status_change", "system", "created"], required: true },
    text: { type: String, required: true },
    byName: { type: String },
    byEmail: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SymxHrTicketSchema = new Schema<ISymxHrTicket>(
  {
    ticketNumber: { type: String, index: true },
    transporterId: { type: String, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee" },
    employeeMatchType: { type: String, enum: ["auto", "manual"] },
    suggestedEmployeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee" },
    category: { type: String },
    issue: { type: String },
    timeOffDateType: { type: String, enum: ["single", "range"] },
    timeOffStartDate: { type: Date },
    timeOffEndDate: { type: Date },
    attachment: { type: String },
    managersEmail: { type: String },
    notes: { type: String },
    approveDeny: { type: String },
    resolution: { type: String },
    holdReason: { type: String },
    closedDateTime: { type: Date },
    closedBy: { type: String },
    closedTicketSent: { type: String },
    createdBy: { type: String },
    source: { type: String, enum: ["public", "admin", "import"], default: "admin" },
    submitterName: { type: String },
    submitterEmail: { type: String },
    submitterIp: { type: String },
    status: { type: String, enum: ["open", "on_hold", "approved", "denied", "closed"], default: "open", index: true },
    priority: { type: String, enum: ["low", "normal", "high"], default: "normal" },
    assignedTo: { type: String, index: true },
    activity: { type: [HrTicketActivitySchema], default: [] },
  },
  { timestamps: true, collection: "symxhrtickets" }
);

SymxHrTicketSchema.index({ transporterId: 1, ticketNumber: 1 });

const SymxHrTicket =
  mongoose.models.SymxHrTicket ||
  mongoose.model<ISymxHrTicket>("SymxHrTicket", SymxHrTicketSchema);

export default SymxHrTicket;
