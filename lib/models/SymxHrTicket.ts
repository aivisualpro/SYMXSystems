import mongoose, { Schema, Document } from "mongoose";

export interface ISymxHrTicket extends Document {
  ticketNumber?: string;
  transporterId?: string;
  // Links this ticket to a real SymxEmployee record. Set manually by
  // whoever reviews the ticket in the admin Tickets workbench (via the
  // employee-link picker) — never inferred automatically from anything a
  // driver typed on the public form, since that's unverified input.
  employeeId?: mongoose.Types.ObjectId;
  category?: string;
  issue?: string;
  attachment?: string;
  managersEmail?: string;
  notes?: string;
  approveDeny?: string;
  resolution?: string;
  holdReason?: string;
  closedDateTime?: Date;
  closedBy?: string;
  closedTicketSent?: string;
  createdBy?: string;
  // Which channel this ticket came in through — lets the admin UI
  // distinguish driver-submitted tickets from ones staff created directly.
  source?: "public" | "admin" | "import";
  // Explicit submitter identity fields, set by the public form. Kept
  // separate from managersEmail (which admins use for the ticket's
  // routing/manager contact) so the two don't collide.
  submitterName?: string;
  submitterEmail?: string;
  // Best-effort submitter IP, recorded only on public submissions for
  // lightweight abuse throttling/auditing — never shown in the UI.
  submitterIp?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const SymxHrTicketSchema = new Schema<ISymxHrTicket>(
  {
    ticketNumber: { type: String, index: true },
    transporterId: { type: String, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee" },
    category: { type: String },
    issue: { type: String },
    attachment: { type: String },
    managersEmail: { type: String },
    notes: { type: String },
    approveDeny: { type: String },
    resolution: { type: String },
    holdReason: { type: String },
    closedDateTime: { type: Date },
    closedBy: { type: String },
    closedTicketSent: { type: String },
    createdBy: { type: String },
    source: { type: String, enum: ["public", "admin", "import"], default: "admin" },
    submitterName: { type: String },
    submitterEmail: { type: String },
    submitterIp: { type: String },
  },
  { timestamps: true, collection: "symxhrtickets" }
);

SymxHrTicketSchema.index({ transporterId: 1, ticketNumber: 1 });

const SymxHrTicket =
  mongoose.models.SymxHrTicket ||
  mongoose.model<ISymxHrTicket>("SymxHrTicket", SymxHrTicketSchema);

export default SymxHrTicket;
