import mongoose, { Schema, Document } from "mongoose";

// Single-document collection (station-scoped app, so just one row) — mirrors
// the WriteupSettings pattern. Configures the public HR ticket intake form:
// who gets notified by email when a new ticket comes in, plus an atomic
// counter for ticket numbers shared by BOTH the public form and admin-created
// tickets so numbering can never collide between the two entry points.
export interface ISymxHrTicketSettings extends Document {
  notificationEmails: string[];
  lastTicketNumber: number;
  updatedAt?: Date;
  createdAt?: Date;
}

const SymxHrTicketSettingsSchema = new Schema<ISymxHrTicketSettings>(
  {
    notificationEmails: { type: [String], default: [] },
    lastTicketNumber: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "symxhrticketsettings" }
);

const SymxHrTicketSettings =
  mongoose.models.SymxHrTicketSettings ||
  mongoose.model<ISymxHrTicketSettings>("SymxHrTicketSettings", SymxHrTicketSettingsSchema);

export default SymxHrTicketSettings;
