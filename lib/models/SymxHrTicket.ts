import mongoose, { Schema, Document } from "mongoose";

export interface ISymxHrTicket extends Document {
  ticketNumber?: string;
  transporterId?: string;
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
  },
  { timestamps: true, collection: "symxhrtickets" }
);

SymxHrTicketSchema.index({ transporterId: 1, ticketNumber: 1 });

const SymxHrTicket =
  mongoose.models.SymxHrTicket ||
  mongoose.model<ISymxHrTicket>("SymxHrTicket", SymxHrTicketSchema);

export default SymxHrTicket;
