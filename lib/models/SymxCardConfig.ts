import mongoose, { Schema, Document, Model } from 'mongoose';
import { siteOwned } from "./plugins/site-owned";

export interface ICardConfig {
  index: number;
  name: string;
  bgDark?: string;
  bgLight?: string;
}

export interface ISymxCardConfig extends Document {
  page: string; // 'dispatch' | 'hr' | 'manager' | 'reports' | 'owner'
  cards: ICardConfig[];
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const CardConfigItemSchema = new Schema({
  index: { type: Number, required: true },
  name: { type: String, required: true },
  bgDark: { type: String },
  bgLight: { type: String },
}, { _id: false });

const SymxCardConfigSchema: Schema = new Schema({
  page: { type: String, required: true, unique: true },
  cards: { type: [CardConfigItemSchema], default: [] },
  updatedBy: { type: String },
}, {
  timestamps: true,
  bufferCommands: true,
});

// ── Multi-site ──
// Station that owns these records. Immutable: a later transfer does
// not move history. Optional during the migration window; required
// after the Phase 5 contract step.
SymxCardConfigSchema.plugin(siteOwned);

const SymxCardConfig: Model<ISymxCardConfig> = mongoose.models.SymxCardConfig || mongoose.model<ISymxCardConfig>('SymxCardConfig', SymxCardConfigSchema);

export default SymxCardConfig;
