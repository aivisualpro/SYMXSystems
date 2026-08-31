import mongoose, { Schema, Document, Model } from 'mongoose';
import { siteOwned } from "./plugins/site-owned";

export interface ISymxAvailableWeek extends Document {
  /** Owning station. Added by the siteOwned plugin; optional until
   *  siteId becomes required at the Phase 5 contract step. */
  siteId?: mongoose.Types.ObjectId;
  week: string;
}

const SymxAvailableWeekSchema: Schema = new Schema({
  week: { type: String, required: true },
}, { timestamps: true, collection: 'SymxAvailableWeeks' });

// ── Multi-site ──
// Station that owns these records. Immutable: a later transfer does
// not move history. Optional during the migration window; required
// after the Phase 5 contract step.
//
// ── Unique PER STATION, not globally ──────────────────────────────────
// `week` used to be globally unique (from before multi-site), so the
// SECOND station ever to generate a given calendar week — any week DFO2
// had already touched, which by now is nearly all of them — hit
// `E11000 duplicate key ... week_1` on its very first "Generate week" and
// could never generate a schedule at all. Scoped to siteId, each station
// owns its own row per week and they can legitimately share the same
// week string.
SymxAvailableWeekSchema.index({ siteId: 1, week: 1 }, { unique: true });

SymxAvailableWeekSchema.plugin(siteOwned, { sortField: "week", modelName: "SymxAvailableWeek" });

const SymxAvailableWeek: Model<ISymxAvailableWeek> =
  mongoose.models.SymxAvailableWeek ||
  mongoose.model<ISymxAvailableWeek>('SymxAvailableWeek', SymxAvailableWeekSchema);

export default SymxAvailableWeek;
