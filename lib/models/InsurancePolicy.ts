import mongoose, { Schema, Document, Model } from "mongoose";
import { INSURANCE_POLICY_TYPES } from "@/lib/constants/insurance";

// Re-exported for convenience on the server side; client components should
// import from "@/lib/constants/insurance" directly to avoid pulling this
// Mongoose model (and mongoose itself) into the browser bundle.
export { INSURANCE_POLICY_TYPES };

export interface IInsurancePolicy extends Document {
  policyNumber: string;
  startDate?: Date;
  endDate?: Date;
  company: string;
  type: string;

  // ── Official numbers, manually entered from the insurer's Loss Run report ──
  // These are NOT computed — they reflect whatever the insurer last reported,
  // which may lag behind incidents logged in the app (hence showing both).
  lossRatio?: number;
  claimsIncurred?: number;
  claimsPaid?: number;
  premiumPaid?: number;
  totalClaims?: number;
  openClaims?: number;
  policyLimit?: number;

  // Full upload history — never pruned. Insurers issue loss runs periodically
  // (often multiple times a year) and older ones stay here for audit trail;
  // the most recently uploaded entry is treated as "current" by the UI.
  lossRuns?: { url: string; filename: string; uploadedAt: Date; uploadedBy: string }[];

  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InsurancePolicySchema = new Schema<IInsurancePolicy>(
  {
    policyNumber: { type: String, required: true, index: true },
    startDate: { type: Date },
    endDate: { type: Date },
    company: { type: String, default: "" },
    type: { type: String, default: "Auto", index: true },

    lossRatio: { type: Number },
    claimsIncurred: { type: Number },
    claimsPaid: { type: Number },
    premiumPaid: { type: Number },
    totalClaims: { type: Number },
    openClaims: { type: Number },
    policyLimit: { type: Number },

    lossRuns: [{
      url: { type: String, required: true },
      filename: { type: String, default: "" },
      uploadedAt: { type: Date, default: Date.now },
      uploadedBy: { type: String, default: "" },
      _id: false,
    }],

    notes: { type: String, default: "" },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true, collection: "SYMXInsurancePolicies" }
);

InsurancePolicySchema.index({ type: 1, startDate: 1, endDate: 1 });

const InsurancePolicy: Model<IInsurancePolicy> =
  mongoose.models.InsurancePolicy ||
  mongoose.model<IInsurancePolicy>("InsurancePolicy", InsurancePolicySchema);

export default InsurancePolicy;
