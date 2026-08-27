import mongoose, { Schema, Document, Model } from 'mongoose';
import { siteOwned } from "./plugins/site-owned";

export interface ICardConfig {
  index: number;
  name: string;
  bgDark?: string;
  bgLight?: string;
}

export interface ISymxCardConfig extends Document {
  /** Owning station. Added by the siteOwned plugin; optional until
   *  siteId becomes required at the Phase 5 contract step. */
  siteId?: mongoose.Types.ObjectId;
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
  page: { type: String, required: true },
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
// ── Unique PER STATION, not globally ──────────────────────────────────
// Card config pages were globally unique, which makes per-station config
// impossible: DXC8 could not have its own "page" value if DFO2 already
// used it. The clone that seeds a new station's config would fail with a
// duplicate key error, and the station would be left with none.
//
// Scoped to siteId, each station owns its own set and they can share names
// — which is the normal case, since stations run the same kinds of work at
// different rates and start times.
SymxCardConfigSchema.index({ siteId: 1, page: 1 }, { unique: true });

SymxCardConfigSchema.plugin(siteOwned, { modelName: "SymxCardConfig" });

const SymxCardConfig: Model<ISymxCardConfig> = mongoose.models.SymxCardConfig || mongoose.model<ISymxCardConfig>('SymxCardConfig', SymxCardConfigSchema);

export default SymxCardConfig;
