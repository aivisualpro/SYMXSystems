import mongoose, { Schema, Document } from "mongoose";

export interface ISymxReimbursement extends Document {
  transporterId: string;
  employeeName?: string;
  employeeId?: mongoose.Types.ObjectId;
  date?: Date;
  category?: string;
  description?: string;
  amount?: number;
  receiptNumber?: string;
  status?: string;
  approvedBy?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const SymxReimbursementSchema = new Schema<ISymxReimbursement>(
  {
    transporterId: { type: String, required: true, index: true },
    employeeName: { type: String },
    employeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee" },
    date: { type: Date },
    category: { type: String },
    description: { type: String },
    amount: { type: Number },
    receiptNumber: { type: String },
    status: { type: String, default: "Pending" },
    approvedBy: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

// Compound index for upsert
SymxReimbursementSchema.index({ transporterId: 1, date: 1, receiptNumber: 1 });

const SymxReimbursement =
  mongoose.models.SymxReimbursement ||
  mongoose.model<ISymxReimbursement>("SymxReimbursement", SymxReimbursementSchema);

export default SymxReimbursement;
