import mongoose, { Schema, Document } from "mongoose";

// ── Verbal Coaching log ──
// A lightweight, high-volume companion to the formal Write-Up ladder.
// These are the everyday, scorecard-triggered coaching conversations a
// dispatch/ops lead has with a DA — no warning level, and often not even
// completed ("Unable to Coach" — driver never reached). A driver signature
// is optional (unlike formal Write-Ups, where it's required to close).
// They do NOT count toward the formal escalation math (see
// lib/writeup-logic.ts) — only signed/formal Write-Ups do — but they
// show up as context when a manager creates a formal write-up, matching
// the "prior discussion or warnings (oral, written, dates)" section of
// SYMX's corrective-action notice.

export interface IVerbalCoachingSignature {
  name: string;
  signatureImage: string;
  signedAt: Date;
}

export interface IVerbalCoaching extends Document {
  transporterId: string;
  employeeId?: mongoose.Types.ObjectId;
  employeeName: string;

  categoryIds: mongoose.Types.ObjectId[]; // ref DropdownOption (type: "metric") — a single coaching often covers multiple metrics
  categoryLabels: string[]; // denormalized snapshot

  coachingDate: Date;
  coachedBy: string; // free text — often a dispatch lead, not necessarily a system user

  // new: just logged, nothing actioned yet (the default — a dispatcher
  //   shouldn't have to affirmatively lie and say "completed" just to
  //   save a record)
  // scheduled: legacy value from historical import — ambiguous
  //   "New"/"Scheduled" source rows collapse here, kept only for old data
  // completed / unable_to_coach: terminal, resolved states
  status: string; // new | scheduled | completed | unable_to_coach

  notes: string;
  disputed: boolean;
  disputeNotes?: string;

  // Optional — captured when a dispatcher marks the coaching complete in
  // person with the driver, mirroring the formal Write-Up signature flow.
  driverSignature?: IVerbalCoachingSignature;

  isHistorical: boolean;

  // Set once this coaching is used as the basis for escalating to a
  // formal write-up, so it doesn't get offered for escalation twice.
  linkedWriteupId?: mongoose.Types.ObjectId;

  // "Entered by/when" is createdBy/createdAt below. These separately
  // capture "completed by/when" so the detail view can show the full
  // start-to-finish trail even when a coaching sits in New for a while
  // before someone actually has the conversation.
  completedBy?: string;
  completedAt?: Date;

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const VerbalCoachingSignatureSchema = new Schema(
  {
    name: { type: String, required: true },
    signatureImage: { type: String, required: true },
    signedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const VerbalCoachingSchema = new Schema<IVerbalCoaching>(
  {
    transporterId: { type: String, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee", index: true },
    employeeName: { type: String, default: "" },

    categoryIds: { type: [Schema.Types.ObjectId], ref: "DropdownOption", default: [] },
    categoryLabels: { type: [String], default: [] },

    coachingDate: { type: Date, default: Date.now },
    coachedBy: { type: String, default: "" },

    status: { type: String, default: "new" },

    notes: { type: String, default: "" },
    disputed: { type: Boolean, default: false },
    disputeNotes: { type: String, default: "" },

    driverSignature: { type: VerbalCoachingSignatureSchema },

    isHistorical: { type: Boolean, default: false },
    linkedWriteupId: { type: Schema.Types.ObjectId, ref: "Writeup" },

    completedBy: { type: String, default: "" },
    completedAt: { type: Date },

    createdBy: { type: String, default: "" },
  },
  { timestamps: true, collection: "SYMXVerbalCoachings" }
);

VerbalCoachingSchema.index({ employeeId: 1, coachingDate: -1 });
VerbalCoachingSchema.index({ status: 1, coachingDate: -1 });

const VerbalCoaching = mongoose.models.VerbalCoaching || mongoose.model<IVerbalCoaching>("VerbalCoaching", VerbalCoachingSchema);

export default VerbalCoaching;
