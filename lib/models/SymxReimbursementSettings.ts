import mongoose, { Schema, Document } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

// Single-document collection (station-scoped app, so just one row) — mirrors
// SymxHrTicketSettings. Configures the public reimbursement intake form: who
// gets notified by email when a driver submits a request, plus an atomic
// counter for request numbers shared by both the public form and admin-
// created requests so numbering can never collide between the two entry
// points.
export interface ISymxReimbursementSettings extends Document {
  notificationEmails: string[];
  lastRequestNumber: number;
  updatedAt?: Date;
  createdAt?: Date;
}

const SymxReimbursementSettingsSchema = new Schema<ISymxReimbursementSettings>(
  {
    notificationEmails: { type: [String], default: [] },
    lastRequestNumber: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "symxreimbursementsettings" }
);

// ── Multi-site ──
// Station that owns these records. Immutable: a later transfer does
// not move history. Optional during the migration window; required
// after the Phase 5 contract step.
SymxReimbursementSettingsSchema.plugin(siteOwned, { modelName: "SymxReimbursementSettings" });

const SymxReimbursementSettings =
  mongoose.models.SymxReimbursementSettings ||
  mongoose.model<ISymxReimbursementSettings>("SymxReimbursementSettings", SymxReimbursementSettingsSchema);

export default SymxReimbursementSettings;
