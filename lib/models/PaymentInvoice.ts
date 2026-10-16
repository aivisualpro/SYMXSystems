import mongoose, { Schema, Model } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

/**
 * An Amazon invoice (weekly variable, monthly fleet, incentive, promotion, other),
 * synced from the Payments portal by the extension. SUPER ADMIN ONLY data.
 * `tables` keeps the invoice's own summary tables verbatim so every invoice type
 * is stored, even ones we don't audit yet.
 */
const TableSchema = new Schema({
  heading: String,
  columns: [String],
  rows: [{ group: [String], lines: [[String]], _id: false }],
}, { _id: false });

const ChecklistSchema = new Schema({
  wst: { type: Boolean, default: false },        // Work Summary Tool confirmed/corrected
  routes: { type: Boolean, default: false },     // route counts reviewed
  upd: { type: Boolean, default: false },        // delay payments reviewed
  rescues: { type: Boolean, default: false },    // rescue blocks reviewed
  packages: { type: Boolean, default: false },   // package + pickup counts reviewed
  passThrough: { type: Boolean, default: false },// incentive/promotion passed to DAs
}, { _id: false });

const PaymentInvoiceSchema = new Schema({
  batchId: { type: String, required: true },
  invoiceNumber: { type: String, default: "" },
  stationCode: { type: String, default: "" },
  type: { type: String, default: "" },          // SERVICE_PROVIDED | VEHICLE_PAYMENT_V2 | INCENTIVE_PAYMENT | PROMOTION | ASSET_PAYMENT ...
  flow: { type: String, default: "ORIGINAL" },  // ORIGINAL | ADJUSTMENT
  label: { type: String, default: "" },         // "Week 41", "October"
  periodStart: { type: String, default: "" },   // YYYY-MM-DD
  periodEnd: { type: String, default: "" },
  invoiceDate: { type: String, default: "" },
  paymentDate: { type: String, default: "" },
  amount: { type: Number, default: 0 },
  amazonStatus: { type: String, default: "" },
  approvalStatus: { type: String, default: "" }, // PENDING_DSP_ACTION | APPROVED
  disputeWindowStatus: { type: String, default: "" },
  disputeDueAt: { type: Date },
  disputesFiled: { type: Number, default: 0 },
  adjustmentAmount: { type: Number, default: 0 },
  tables: { type: [TableSchema], default: [] },
  hasDetail: { type: Boolean, default: false },
  routeCount: { type: Number, default: 0 },
  coverage: { type: Schema.Types.Mixed, default: {} },   // how much of the period SYMX has data for
  // owner workflow (ours, not Amazon's)
  myStatus: { type: String, default: "to_review" }, // to_review | reviewing | ready_to_accept | disputed | accepted
  checklist: { type: ChecklistSchema, default: () => ({}) },
  notes: { type: String, default: "" },
  reviewedBy: { type: String, default: "" },
  reviewedAt: { type: Date },
  lastSyncedAt: { type: Date },
}, { timestamps: true, collection: "SYMXPaymentInvoices" });

siteOwned(PaymentInvoiceSchema, { sortField: "invoiceDate", modelName: "PaymentInvoice" });
PaymentInvoiceSchema.index({ siteId: 1, batchId: 1 }, { unique: true });

const PaymentInvoice: Model<any> = mongoose.models.PaymentInvoice || mongoose.model("PaymentInvoice", PaymentInvoiceSchema);
export default PaymentInvoice;
