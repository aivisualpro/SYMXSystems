import mongoose, { Schema, Document } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

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

// Index for per-employee note lookups and aggregate counts
SymxEmployeeNoteSchema.index({ transporterId: 1, createdAt: -1 });

// ── Multi-site ──
// Station that owns these records. Immutable: a later transfer does
// not move history. Optional during the migration window; required
// after the Phase 5 contract step.
SymxEmployeeNoteSchema.plugin(siteOwned, { sortField: "createdAt", modelName: "SYMXEmployeeNote" });

const SymxEmployeeNote =
  mongoose.models.SYMXEmployeeNote ||
  mongoose.model<ISymxEmployeeNote>("SYMXEmployeeNote", SymxEmployeeNoteSchema, "SYMXEmployeeNotes");

export default SymxEmployeeNote;
