import mongoose, { Schema, Model } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

/** A possible billing issue found by comparing an invoice with what SYMX captured. */
const PaymentFindingSchema = new Schema({
  key: { type: String, required: true },            // stable id so re-audits don't duplicate
  batchId: { type: String, required: true },
  invoiceNumber: { type: String, default: "" },
  stationCode: { type: String, default: "" },
  kind: { type: String, required: true },           // route_count | rescue_unbilled | upd_candidate | package_count | pickup_count | rate_change
  direction: { type: String, default: "under" },    // under = we think Amazon owes more · over = billed more than we saw · info
  severity: { type: String, default: "review" },    // high | review | info
  date: { type: String, default: "" },              // YYYY-MM-DD or "" for whole invoice
  title: { type: String, default: "" },
  detail: { type: String, default: "" },
  billed: { type: Number },                          // quantity billed
  expected: { type: Number },                        // quantity we counted
  unitRate: { type: Number },
  amount: { type: Number, default: 0 },              // estimated $ at stake (always positive)
  status: { type: String, default: "open" },         // open | dismissed | disputed | resolved
  note: { type: String, default: "" },
  resolvedBy: { type: String, default: "" },
  resolvedAt: { type: Date },
}, { timestamps: true, collection: "SYMXPaymentFindings" });

siteOwned(PaymentFindingSchema, { sortField: "date", modelName: "PaymentFinding" });
PaymentFindingSchema.index({ siteId: 1, key: 1 }, { unique: true });
PaymentFindingSchema.index({ siteId: 1, batchId: 1 });

const PaymentFinding: Model<any> = mongoose.models.PaymentFinding || mongoose.model("PaymentFinding", PaymentFindingSchema);
export default PaymentFinding;
