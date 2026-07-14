import mongoose, { Schema, Document } from "mongoose";

// ── Verbal Coaching log ──
// A lightweight, high-volume companion to the formal Write-Up ladder.
// These are the everyday, scorecard-triggered coaching conversations a
// dispatch/ops lead has with a DA — no signature, no warning level, and
// often not even completed ("Unable to Coach" — driver never reached).
// They do NOT count toward the formal escalation math (see
// lib/writeup-logic.ts) — only signed/formal Write-Ups do — but they
// show up as context when a manager creates a formal write-up, matching
// the "prior discussion or warnings (oral, written, dates)" section of
// SYMX's corrective-action notice.

export interface IVerbalCoaching extends Document {
  transporterId: string;
  employeeId?: mongoose.Types.ObjectId;
  employeeName: string;

  categoryIds: mongoose.Types.ObjectId[]; // ref DropdownOption (type: "metric") — a single coaching often covers multiple metrics
  categoryLabels: string[]; // denormalized snapshot

  coachingDate: Date;
  coachedBy: string; // free text — often a dispatch lead, not necessarily a system user

  status: string; // completed | unable_to_coach | scheduled

  notes: string;
  disputed: boolean;
  disputeNotes?: string;

  isHistorical: boolean;

  // Set once this coaching is used as the basis for escalating to a
  // formal write-up, so it doesn't get offered for escalation twice.
  linkedWriteupId?: mongoose.Types.ObjectId;

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const VerbalCoachingSchema = new Schema<IVerbalCoaching>(
  {
    transporterId: { type: String, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee", index: true },
    employeeName: { type: String, default: "" },

    categoryIds: { type: [Schema.Types.ObjectId], ref: "DropdownOption", default: [] },
    categoryLabels: { type: [String], default: [] },

    coachingDate: { type: Date, default: Date.now },
    coachedBy: { type: String, default: "" },

    status: { type: String, default: "completed" },

    notes: { type: String, default: "" },
    disputed: { type: Boolean, default: false },
    disputeNotes: { type: String, default: "" },

    isHistorical: { type: Boolean, default: false },
    linkedWriteupId: { type: Schema.Types.ObjectId, ref: "Writeup" },

    createdBy: { type: String, default: "" },
  },
  { timestamps: true, collection: "SYMXVerbalCoachings" }
);

VerbalCoachingSchema.index({ employeeId: 1, coachingDate: -1 });
VerbalCoachingSchema.index({ status: 1, coachingDate: -1 });

const VerbalCoaching = mongoose.models.VerbalCoaching || mongoose.model<IVerbalCoaching>("VerbalCoaching", VerbalCoachingSchema);

export default VerbalCoaching;
