import mongoose, { Schema, Document } from "mongoose";

export interface ISymxReimbursement extends Document {
  transporterId: string;
  legacyId?: string;
  employeeName?: string;
  employeeId?: mongoose.Types.ObjectId;
  date?: Date;
  week?: string;
  category?: string;
  description?: string;
  amount?: number;
  receiptNumber?: string;
  status?: string;
  approvedBy?: string;
  notes?: string;
  attachment?: string;
  createdBy?: string;
  updatedBy?: string;
  updatedOn?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const SymxReimbursementSchema = new Schema<ISymxReimbursement>(
  {
    transporterId: { type: String, required: true, index: true },
    legacyId: { type: String, sparse: true, unique: true },
    employeeName: { type: String },
    employeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee" },
    date: { type: Date },
    week: { type: String, index: true },
    category: { type: String },
    description: { type: String },
    amount: { type: Number },
    receiptNumber: { type: String },
    status: { type: String, default: "Pending" },
    approvedBy: { type: String },
    notes: { type: String },
    attachment: { type: String },
    createdBy: { type: String },
    updatedBy: { type: String },
    updatedOn: { type: String },
  },
  { timestamps: true }
);

// Compound index for upsert
SymxReimbursementSchema.index({ transporterId: 1, date: 1 });

const SymxReimbursement =
  mongoose.models.SymxReimbursement ||
  mongoose.model<ISymxReimbursement>("SymxReimbursement", SymxReimbursementSchema);

export default SymxReimbursement;
