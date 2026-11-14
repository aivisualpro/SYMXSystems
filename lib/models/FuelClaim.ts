import mongoose, { Schema, Document } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

// A fuel / EV-charging purchase made OUTSIDE the normal gas-card process.
// Amazon reimburses these, so each one is submitted to Amazon with the
// receipt and tracked until Amazon approves or denies it.

export type FuelClaimStatus = "needs_submission" | "submitted" | "approved" | "denied";

export interface IFuelClaimActivity {
  text: string;
  byName?: string;
  byEmail?: string;
  createdAt: Date;
}

export interface IFuelClaim extends Document {
  siteId?: mongoose.Types.ObjectId;
  claimNumber: string;
  date: Date; // day the fuel/charge was bought
  expenseType: "Fuel" | "EV Charging";
  driverName: string;
  transporterId?: string;
  employeeId?: mongoose.Types.ObjectId;
  tripType: "Route" | "Rescue";
  routeNumber?: string;
  vendor?: string; // gas station / charging network + location
  amount: number;
  paidWith?: string; // how the driver paid
  driverRepaid?: "yes" | "no" | "not_needed";
  notes?: string;
  receipts: string[]; // receipt photo URLs
  // Amazon reimbursement tracking
  status: FuelClaimStatus;
  submittedDate?: Date;
  amazonReference?: string;
  approvedAmount?: number;
  decidedDate?: Date;
  denialReason?: string;
  // Saved printout
  pdfUrl?: string;
  pdfPublicId?: string;
  pdfGeneratedAt?: Date;
  activity: IFuelClaimActivity[];
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FuelClaimSchema = new Schema<IFuelClaim>(
  {
    claimNumber: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    expenseType: { type: String, enum: ["Fuel", "EV Charging"], default: "Fuel" },
    driverName: { type: String, required: true },
    transporterId: { type: String, default: "" },
    employeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee" },
    tripType: { type: String, enum: ["Route", "Rescue"], default: "Route" },
    routeNumber: { type: String, default: "" },
    vendor: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    paidWith: { type: String, default: "" },
    driverRepaid: { type: String, enum: ["yes", "no", "not_needed"], default: "no" },
    notes: { type: String, default: "" },
    receipts: { type: [String], default: [] },
    status: { type: String, enum: ["needs_submission", "submitted", "approved", "denied"], default: "needs_submission", index: true },
    submittedDate: { type: Date },
    amazonReference: { type: String, default: "" },
    approvedAmount: { type: Number },
    decidedDate: { type: Date },
    denialReason: { type: String, default: "" },
    pdfUrl: { type: String, default: "" },
    pdfPublicId: { type: String, default: "" },
    pdfGeneratedAt: { type: Date },
    activity: {
      type: [{ text: String, byName: String, byEmail: String, createdAt: { type: Date, default: Date.now }, _id: false }],
      default: [],
    },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true, collection: "symxfuelclaims" }
);

FuelClaimSchema.plugin(siteOwned, { sortField: "date", modelName: "FuelClaim", extraIndexes: [["status", "date"]] });

const FuelClaim =
  (mongoose.models.FuelClaim as mongoose.Model<IFuelClaim>) ||
  mongoose.model<IFuelClaim>("FuelClaim", FuelClaimSchema);

export default FuelClaim;
