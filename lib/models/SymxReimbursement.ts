import mongoose, { Schema, Document } from "mongoose";

// Redesigned reimbursement lifecycle (July 2026). Three actors feed this
// collection: a driver submitting their own itemized request through the
// public form (no login exists for drivers — see app/submit-reimbursement),
// a manager/HR staffer entering one on a driver's behalf from the admin
// workbench, and whoever handles payroll (owner/finance) resolving it either
// as a direct payment or by queuing it into the next payroll run. See
// docs in app/(protected)/hr/reimbursement/page.tsx for the full workbench.
export type ReimbursementStatus = "pending" | "approved" | "denied" | "queued_for_payroll" | "paid";

export interface IReimbursementItem {
  description: string;
  category?: string;
  amount: number;
}

export interface IReimbursementActivityEntry {
  // "note" = free text someone typed. "status_change" = approve/deny/reopen.
  // "payment" = a payment-related action (marked paid direct, queued for
  // payroll, payroll confirmed, payment reverted). "system" = other
  // system-generated lines (employee link/unlink). "created" = opening entry.
  type: "note" | "status_change" | "payment" | "system" | "created";
  text: string;
  byName?: string;
  byEmail?: string;
  createdAt: Date;
}

export interface ISymxReimbursement extends Document {
  requestNumber?: string;
  transporterId?: string;
  employeeName?: string;
  // Links this request to a real SymxEmployee record. Set manually via the
  // admin workbench's employee-link picker, or automatically at public
  // submission time when the submitter's name/email is an unambiguous exact
  // match (see employeeMatchType, mirrors the HR ticket matching pattern).
  employeeId?: mongoose.Types.ObjectId;
  employeeMatchType?: "auto" | "manual";
  // Same-signal-but-ambiguous match found at public submission time —
  // surfaced in the admin UI as a one-click "confirm" suggestion.
  suggestedEmployeeId?: mongoose.Types.ObjectId;
  date?: Date;
  week?: string; // computed Sunday-week bucket, kept for CSV import compatibility
  // Itemized expense lines. New requests (public or admin) are always
  // itemized; `amount` is kept in sync as the sum of items via a pre-save
  // hook below. Legacy/CSV-imported records may have no items at all, in
  // which case `amount`/`category`/`description` are the source of truth.
  items?: IReimbursementItem[];
  category?: string; // legacy top-level field; also mirrors items[0].category for old records
  description?: string; // legacy top-level field
  amount?: number; // total — derived from items when items[] is present
  receiptNumber?: string;
  attachment?: string; // legacy single-file field, kept for backward compat
  attachments?: string[]; // shared receipt pool for the whole request
  status?: ReimbursementStatus;
  // Review/approval
  reviewedBy?: string;
  reviewedAt?: Date;
  denyReason?: string;
  approvedBy?: string; // legacy field, some old records still have it
  notes?: string;
  // Payment resolution — two paths. "direct" is a one-shot payment (check/
  // ACH/cash) outside payroll. "payroll" queues the request to go out with
  // the employee's next paycheck; payrollConfirmed* is set once whoever runs
  // payroll confirms it actually went out, at which point status flips to
  // "paid" the same as a direct payment.
  paymentMethod?: "direct" | "payroll";
  paidDate?: Date;
  paidBy?: string;
  paymentReference?: string;
  payrollQueuedAt?: Date;
  payrollQueuedBy?: string;
  payrollBatchLabel?: string;
  payrollConfirmedAt?: Date;
  payrollConfirmedBy?: string;
  // Chronological case log — notes, status changes, payment actions, and
  // employee link/unlink, mirrors the HR ticket activity log.
  activity?: IReimbursementActivityEntry[];
  // Which channel this request came in through.
  source?: "public" | "admin" | "import";
  submitterName?: string;
  submitterEmail?: string;
  submitterIp?: string;
  createdBy?: string;
  updatedBy?: string;
  updatedOn?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ReimbursementItemSchema = new Schema<IReimbursementItem>(
  {
    description: { type: String, required: true },
    category: { type: String },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const ReimbursementActivitySchema = new Schema<IReimbursementActivityEntry>(
  {
    type: { type: String, enum: ["note", "status_change", "payment", "system", "created"], required: true },
    text: { type: String, required: true },
    byName: { type: String },
    byEmail: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SymxReimbursementSchema = new Schema<ISymxReimbursement>(
  {
    requestNumber: { type: String, index: true },
    transporterId: { type: String, index: true },
    employeeName: { type: String },
    employeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee", index: true },
    employeeMatchType: { type: String, enum: ["auto", "manual"] },
    suggestedEmployeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee" },
    date: { type: Date },
    week: { type: String, index: true },
    items: { type: [ReimbursementItemSchema], default: undefined },
    category: { type: String },
    description: { type: String },
    amount: { type: Number },
    receiptNumber: { type: String },
    attachment: { type: String },
    attachments: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["pending", "approved", "denied", "queued_for_payroll", "paid"],
      default: "pending",
      index: true,
    },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    denyReason: { type: String },
    approvedBy: { type: String },
    notes: { type: String },
    paymentMethod: { type: String, enum: ["direct", "payroll"] },
    paidDate: { type: Date },
    paidBy: { type: String },
    paymentReference: { type: String },
    payrollQueuedAt: { type: Date },
    payrollQueuedBy: { type: String },
    payrollBatchLabel: { type: String },
    payrollConfirmedAt: { type: Date },
    payrollConfirmedBy: { type: String },
    activity: { type: [ReimbursementActivitySchema], default: [] },
    source: { type: String, enum: ["public", "admin", "import"], default: "admin", index: true },
    submitterName: { type: String },
    submitterEmail: { type: String },
    submitterIp: { type: String },
    createdBy: { type: String },
    updatedBy: { type: String },
    updatedOn: { type: String },
  },
  { timestamps: true }
);

// Compound index for CSV upsert matching (unchanged from before the redesign).
SymxReimbursementSchema.index({ transporterId: 1, date: 1 });

// Keeps `amount` in sync as the sum of itemized lines whenever items[] is
// present, so every consumer that just reads `amount` (KPIs, CSV export,
// legacy code) stays correct without needing to know about itemization.
SymxReimbursementSchema.pre("save", function () {
  if (this.items && this.items.length > 0) {
    this.amount = this.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    if (!this.category) this.category = this.items[0]?.category;
  }
});

const SymxReimbursement =
  mongoose.models.SymxReimbursement ||
  mongoose.model<ISymxReimbursement>("SymxReimbursement", SymxReimbursementSchema);

export default SymxReimbursement;
