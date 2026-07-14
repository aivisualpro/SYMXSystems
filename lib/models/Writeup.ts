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
}

// Immutable snapshot of prior verbal coachings on the same subject, taken
// at creation time — reference context only (see lib/writeup-logic.ts),
// never counted toward the warning-level recommendation.
export interface IWriteupVerbalCoachingSnapshot {
  coachingDate: Date;
  categoryLabels: string[];
}

// Captures the HR decision once a Suspension Review write-up is escalated.
// Resolving an escalation moves status -> "closed" so it drops out of the
// active review queue while keeping a permanent audit record here.
export interface IWriteupEscalationResolution {
  outcome: string; // suspended | terminated | downgraded | no_action
  suspensionDays?: number;
  notes: string;
  resolvedBy: string;
  resolvedAt: Date;
}

export interface IWriteup extends Document {
  transporterId: string;
  employeeId?: mongoose.Types.ObjectId;
  employeeName: string;

  categoryId?: mongoose.Types.ObjectId; // ref DropdownOption (type: "metric")
  categoryLabel: string; // denormalized snapshot — survives category rename/deactivation

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

  // status: draft | signed | refused_to_sign | uploaded_signed_copy | escalated | closed
  // "escalated" = Suspension Review reached and both/refusal signatures are in —
  // pending HR review. "closed" = either a normal sign-off, OR an escalation
  // that HR has resolved (see `escalation` below for the outcome).
  status: string;
  escalatedAt?: Date; // when status first became "escalated" — drives the HR review queue's age/urgency display
  escalation?: IWriteupEscalationResolution; // set once HR resolves the escalation

  managerName: string;
  managerSignature?: IWriteupSignature;
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

const WriteupSchema = new Schema<IWriteup>(
  {
    transporterId: { type: String, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee", index: true },
    employeeName: { type: String, default: "" },

    categoryId: { type: Schema.Types.ObjectId, ref: "DropdownOption" },
    categoryLabel: { type: String, default: "" },

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

    status: { type: String, default: "draft" },
    escalatedAt: { type: Date },
    escalation: { type: WriteupEscalationResolutionSchema },

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
