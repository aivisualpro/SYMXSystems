import mongoose, { Schema, Document, Model } from 'mongoose';
import { siteOwned } from "./plugins/site-owned";

export interface ISymxAvailableWeek extends Document {
  week: string;
}

const SymxAvailableWeekSchema: Schema = new Schema({
  week: { type: String, required: true, unique: true },
}, { timestamps: true, collection: 'SymxAvailableWeeks' });

// ── Multi-site ──
// Station that owns these records. Immutable: a later transfer does
// not move history. Optional during the migration window; required
// after the Phase 5 contract step.
SymxAvailableWeekSchema.plugin(siteOwned, { sortField: "week" });

const SymxAvailableWeek: Model<ISymxAvailableWeek> =
  mongoose.models.SymxAvailableWeek ||
  mongoose.model<ISymxAvailableWeek>('SymxAvailableWeek', SymxAvailableWeekSchema);

export default SymxAvailableWeek;
