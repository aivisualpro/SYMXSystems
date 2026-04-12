import mongoose, { Schema, Document } from "mongoose";

export interface ISymxEmployeeNote extends Document {
  employeeId: mongoose.Types.ObjectId;
  transporterId: string;
  note: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const SymxEmployeeNoteSchema: Schema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee", required: true },
    transporterId: { type: String, required: true },
    note: { type: String, required: true },
    createdBy: { type: String, required: true },
  },
  { collection: "SYMXEmployeeNotes", timestamps: true }
);

const SymxEmployeeNote =
  mongoose.models.SYMXEmployeeNote ||
  mongoose.model<ISymxEmployeeNote>("SYMXEmployeeNote", SymxEmployeeNoteSchema, "SYMXEmployeeNotes");

export default SymxEmployeeNote;
