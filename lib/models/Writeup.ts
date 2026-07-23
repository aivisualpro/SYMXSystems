import mongoose, { Schema, Document } from "mongoose";

// ── Employee Coaching / Write-Up module ──
// Replaces the old ad-hoc SYMXCoachingWriteUp (Dispatching > Coaching
// Write-Ups). Adds a formal progressive-discipline warning ladder,
// in-person e-signature capture, refuse-to-sign/witness handling, and
// historical-record import — none of which existed before.

export interface IWriteupSignature {
  name: string;
  signatureImage: string; // base64 PNG from signature-pad
  signedAt: Date;
}

export interface IWriteupRefusal {
  refused: boolean;
  note?: string;
  witnessName?: string;
  witnessSignatureImage?: string;
  refusedAt?: Date;
}

export interface IWriteupAttachment {
  name: string;
  url: string;
  category: string; // "Signed Upload" | "Evidence" | "Other"
  uploadedAt: Date;
  uploadedBy: string;
}

export interface IWriteupEvent {
  type: string; // created | signed | refused | printed | uploaded_signed_copy | overridden | closed
  actorEmail: string;
  payload?: any;
  occurredAt: Date;
}

export interface IWriteupPriorSnapshot {
  writeupId: mongoose.Types.ObjectId;
  incidentDate: Date;
  warningLevel: string;
  categoryLabel?: string;
  subCategory?: string;
}

export interface IWriteupCategoryBreakdownItem {
  label: string; // subCategory if set, otherwise categoryLabel
  count: number;
}

// Immutable snapshot of prior verbal coachings on the same subject, taken
// at creation time — reference context only (see lib/writeup-logic.ts),
// never counted toward the warning-level recommendation.
export interface IWriteupVerbalCoachingSnapshot {
  coachingDate: Date;
  categoryLabels: string[];
}

// Legacy: captures the HR decision from the old suspension-only escalation
// flow. No longer written by new code (see IWriteupManagerReview below) —
// kept so already-resolved records from before the manager-review redesign
// still display correctly.
export interface IWriteupEscalationResolution {
  outcome: string; // suspended | terminated | downgraded | no_action
  suspensionDays?: number;
  notes: string;
  resolvedBy: string;
  resolvedAt: Date;
}

// Every write-up now waits on a manager decision before it's closed, not
// just the old suspension-level "escalated" cases. Set once by whoever
// reviews it from the Manager Review Workbench (any role with the
// SymxAppRole.isManager flag, gated by the "approve" action on Write-Ups).
export interface IWriteupManagerReview {
  decision: string; // confirmed | escalated
  outcome?: string; // set when decision === "escalated": suspended | terminated | downgraded | no_action
  suspensionDays?: number;
  notes: string;
  reviewedBy: string;
  reviewedAt: Date;
}

export interface IWriteup extends Document {
  transporterId: string;
  employeeId?: mongoose.Types.ObjectId;
  employeeName: string;

  categoryId?: mongoose.Types.ObjectId; // ref DropdownOption (type: "metric")
  categoryLabel: string; // denormalized snapshot — survives category rename/deactivation
  subCategory?: string; // finer-grained reason within categoryLabel (e.g. "Safety Infraction" / "Speeding") — see WriteupSettings.correctiveActionTemplates

  warningLevel: string; // first_warning | second_warning | third_warning | final_warning | suspension_review
  warningLevelAuto: string; // immutable — what the system computed at creation time
  warningLevelOverrideReason?: string;
  warningLevelOverriddenBy?: string;

  incidentDate: Date;
  description?: string;
  planForImprovement?: string;
  consequences?: string;

  priorWriteups: IWriteupPriorSnapshot[]; // immutable snapshot taken at creation time
  priorVerbalCoachings: IWriteupVerbalCoachingSnapshot[]; // reference-only snapshot, same idea

  // Total stacked occurrences within the lookback window used at creation
  // time, INCLUDING this write-up itself (priorWriteups.length + 1), plus
  // the per-sub-category breakdown — e.g. a Safety Infraction write-up for
  // Speeding, with a prior Seatbelt write-up 5 days earlier and a 30-day
  // category lookback override, snapshots totalInfractionCount: 2 and
  // categoryBreakdown: [{label: "Seatbelt", count: 1}, {label: "Speeding",
  // count: 1}]. Immutable at creation like priorWriteups above — see
  // lib/writeup-logic.ts recommendWarningLevel.
  totalInfractionCount?: number;
  categoryBreakdown?: IWriteupCategoryBreakdownItem[];
  lookbackDaysUsed?: number;

  // status: draft | pending_review | closed
  //
  // "pending_review" = the employee has acknowledged (signed, refused, or a
  // signed paper copy was uploaded) and the record is now waiting on a
  // manager's decision from the Review Workbench — every write-up goes
  // through this, not just suspension-level ones. "closed" = a manager has
  // recorded a decision (see `managerReview` below).
  //
  // Legacy values on records created before this redesign: signed |
  // refused_to_sign | uploaded_signed_copy (old terminal states, no review
  // ever happened) and escalated (old suspension-only pending-review state,
  // resolved via the now-retired resolve-escalation endpoint into `escalation`
  // below instead of `managerReview`). These are never written by new code
  // but are left as-is on old documents rather than backfilled.
  status: string;
  acknowledgmentType?: string; // signed | refused | uploaded_signed_copy — how the employee acknowledgment happened, now that status no longer encodes it
  reviewQueuedAt?: Date; // when status first became "pending_review" — drives the workbench's age/urgency display
  escalatedAt?: Date; // legacy — same idea as reviewQueuedAt, only ever set on pre-redesign records
  escalation?: IWriteupEscalationResolution; // legacy — set only by the old, retired resolve-escalation endpoint
  managerReview?: IWriteupManagerReview; // set once a manager resolves the review from the Workbench

  managerName: string;
  managerSignature?: IWriteupSignature; // the account that facilitated in-person signing (issuer — dispatcher, manager, whoever created it). Label in the UI is "Issued By" / "Issuer Signature"; field name kept as-is to avoid a data migration.
  employeeSignature?: IWriteupSignature;
  refusal?: IWriteupRefusal;

  attachments: IWriteupAttachment[];
  events: IWriteupEvent[];

  isHistorical: boolean;

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

const WriteupSignatureSchema = new Schema(
  {
    name: { type: String, default: "" },
    signatureImage: { type: String, default: "" },
    signedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WriteupRefusalSchema = new Schema(
  {
    refused: { type: Boolean, default: false },
    note: { type: String, default: "" },
    witnessName: { type: String, default: "" },
    witnessSignatureImage: { type: String, default: "" },
    refusedAt: { type: Date },
  },
  { _id: false }
);

const WriteupAttachmentSchema = new Schema(
  {
    name: { type: String, default: "" },
    url: { type: String, required: true },
    category: { type: String, default: "Other" },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: String, default: "" },
  },
  { _id: false }
);

const WriteupEventSchema = new Schema(
  {
    type: { type: String, required: true },
    actorEmail: { type: String, default: "" },
    payload: { type: Schema.Types.Mixed },
    occurredAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WriteupPriorSnapshotSchema = new Schema(
  {
    writeupId: { type: Schema.Types.ObjectId, ref: "Writeup" },
    incidentDate: { type: Date },
    warningLevel: { type: String },
    categoryLabel: { type: String, default: "" },
    subCategory: { type: String, default: "" },
  },
  { _id: false }
);

const WriteupCategoryBreakdownItemSchema = new Schema(
  {
    label: { type: String, required: true },
    count: { type: Number, required: true },
  },
  { _id: false }
);

const WriteupVerbalCoachingSnapshotSchema = new Schema(
  {
    coachingDate: { type: Date },
    categoryLabels: { type: [String], default: [] },
  },
  { _id: false }
);

const WriteupEscalationResolutionSchema = new Schema(
  {
    outcome: { type: String, required: true },
    suspensionDays: { type: Number },
    notes: { type: String, default: "" },
    resolvedBy: { type: String, default: "" },
    resolvedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WriteupManagerReviewSchema = new Schema(
  {
    decision: { type: String, required: true },
    outcome: { type: String },
    suspensionDays: { type: Number },
    notes: { type: String, default: "" },
    reviewedBy: { type: String, default: "" },
    reviewedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WriteupSchema = new Schema<IWriteup>(
  {
    transporterId: { type: String, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee", index: true },
    employeeName: { type: String, default: "" },

    categoryId: { type: Schema.Types.ObjectId, ref: "DropdownOption" },
    categoryLabel: { type: String, default: "" },
    subCategory: { type: String, default: "" },

    warningLevel: { type: String, default: "first_warning" },
    warningLevelAuto: { type: String, default: "first_warning" },
    warningLevelOverrideReason: { type: String, default: "" },
    warningLevelOverriddenBy: { type: String, default: "" },

    incidentDate: { type: Date, default: Date.now },
    description: { type: String, default: "" },
    planForImprovement: { type: String, default: "" },
    consequences: { type: String, default: "" },

    priorWriteups: { type: [WriteupPriorSnapshotSchema], default: [] },
    priorVerbalCoachings: { type: [WriteupVerbalCoachingSnapshotSchema], default: [] },
    totalInfractionCount: { type: Number },
    categoryBreakdown: { type: [WriteupCategoryBreakdownItemSchema], default: [] },
    lookbackDaysUsed: { type: Number },

    status: { type: String, default: "draft" },
    acknowledgmentType: { type: String },
    reviewQueuedAt: { type: Date },
    escalatedAt: { type: Date },
    escalation: { type: WriteupEscalationResolutionSchema },
    managerReview: { type: WriteupManagerReviewSchema },

    managerName: { type: String, default: "" },
    managerSignature: { type: WriteupSignatureSchema },
    employeeSignature: { type: WriteupSignatureSchema },
    refusal: { type: WriteupRefusalSchema },

    attachments: { type: [WriteupAttachmentSchema], default: [] },
    events: { type: [WriteupEventSchema], default: [] },

    isHistorical: { type: Boolean, default: false },

    createdBy: { type: String, default: "" },
    closedAt: { type: Date },
  },
  { timestamps: true, collection: "SYMXWriteups" }
);

WriteupSchema.index({ employeeId: 1, categoryId: 1, incidentDate: -1 });
WriteupSchema.index({ status: 1, incidentDate: -1 });
WriteupSchema.index({ isHistorical: 1 });

const Writeup = mongoose.models.Writeup || mongoose.model<IWriteup>("Writeup", WriteupSchema);

export default Writeup;
