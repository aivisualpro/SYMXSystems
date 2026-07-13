import mongoose, { Schema, Document } from "mongoose";

// Single-document collection (station-scoped app, so just one row).
// Configures the progressive-discipline ladder used by
// lib/writeup-logic.ts to auto-recommend a warning level.

export interface IWriteupEscalationThresholds {
  second_warning: number;
  third_warning: number;
  final_warning: number;
  suspension_review: number;
}

export interface IWriteupSettings extends Document {
  lookbackDays: number;
  escalationThresholds: IWriteupEscalationThresholds;
  // Each inner array is a group of DropdownOption `description` values
  // (metric/category labels) that count toward ONE shared escalation
  // count. A category not listed in any group stacks only with itself.
  stackGroups: string[][];
  updatedBy?: string;
  updatedAt: Date;
}

const WriteupSettingsSchema = new Schema<IWriteupSettings>(
  {
    lookbackDays: { type: Number, default: 90 },
    escalationThresholds: {
      second_warning: { type: Number, default: 1 },
      third_warning: { type: Number, default: 2 },
      final_warning: { type: Number, default: 3 },
      suspension_review: { type: Number, default: 4 },
    },
    stackGroups: { type: [[String]], default: [] },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: { createdAt: false, updatedAt: true }, collection: "SYMXWriteupSettings" }
);

const WriteupSettings =
  mongoose.models.WriteupSettings ||
  mongoose.model<IWriteupSettings>("WriteupSettings", WriteupSettingsSchema);

export default WriteupSettings;
