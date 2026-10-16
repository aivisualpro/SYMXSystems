import mongoose, { Schema, Model } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

/** Our own log of disputes filed with Amazon, so outcomes and recovered money can be tracked. */
const PaymentDisputeSchema = new Schema({
  batchId: { type: String, required: true },
  invoiceNumber: { type: String, default: "" },
  stationCode: { type: String, default: "" },
  invoiceLabel: { type: String, default: "" },
  filedAt: { type: Date, default: Date.now },
  category: { type: String, default: "" },          // routes | upd | rescue | packages | pickups | rate | other
  reason: { type: String, default: "" },
  amountClaimed: { type: Number, default: 0 },
  status: { type: String, default: "filed" },       // filed | won | partial | lost
  amountRecovered: { type: Number, default: 0 },
  resolvedAt: { type: Date },
  notes: { type: String, default: "" },
  findingKeys: { type: [String], default: [] },
  createdBy: { type: String, default: "" },
}, { timestamps: true, collection: "SYMXPaymentDisputes" });

siteOwned(PaymentDisputeSchema, { sortField: "filedAt", modelName: "PaymentDispute" });

const PaymentDispute: Model<any> = mongoose.models.PaymentDispute || mongoose.model("PaymentDispute", PaymentDisputeSchema);
export default PaymentDispute;
