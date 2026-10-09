import mongoose, { Schema, Document, Model } from 'mongoose';
import { siteOwned } from "./plugins/site-owned";
import { importProvenance } from "./plugins/import-provenance";
import canonicalIndex from "./cdf-canonical-index.json";

export interface IScoreCardCDFNegative extends Document {
  sourceImportIds?: mongoose.Types.ObjectId[];
  /** Owning station. Added by the siteOwned plugin; optional until
   *  siteId becomes required at the Phase 5 contract step. */
  siteId?: mongoose.Types.ObjectId;
  impactsScorecard?: string;
  disputeStatus?: string;
  action?: string;
  week: string;
  deliveryGroupId: string;
  deliveryAssociate: string;
  deliveryAssociateName: string;
  transporterId?: string;
  daMishandledPackage: string;
  daWasUnprofessional: string;
  daDidNotFollowInstructions: string;
  deliveredToWrongAddress: string;
  neverReceivedDelivery: string;
  receivedWrongItem: string;
  feedbackDetails: string;
  trackingId: string;
  deliveryDate: string;
  employeeId?: mongoose.Types.ObjectId;
}

const ScoreCardCDFNegativeSchema: Schema = new Schema({
  impactsScorecard: { type: String },
  disputeStatus: { type: String },
  action: { type: String },
  week: { type: String, required: true, index: true },
  deliveryGroupId: { type: String },
  deliveryAssociate: { type: String, index: true },
  deliveryAssociateName: { type: String },
  transporterId: { type: String, index: true },
  daMishandledPackage: { type: String, default: '' },
  daWasUnprofessional: { type: String, default: '' },
  daDidNotFollowInstructions: { type: String, default: '' },
  deliveredToWrongAddress: { type: String, default: '' },
  neverReceivedDelivery: { type: String, default: '' },
  receivedWrongItem: { type: String, default: '' },
  feedbackDetails: { type: String, default: '' },
  trackingId: { type: String },
  deliveryDate: { type: String },
  employeeId: { type: Schema.Types.ObjectId, ref: 'SymxEmployee' },
}, { timestamps: true, collection: 'ScoreCard_CDF_Negative', autoIndex: false });

ScoreCardCDFNegativeSchema.index(canonicalIndex.key as Record<string, 1>, {
  name: canonicalIndex.name,
  unique: true,
  partialFilterExpression: canonicalIndex.partialFilterExpression,
  collation: { locale: "simple" },
});

// ── Multi-site ──
// Station that owns these records. Immutable: a later transfer does
// not move history. Optional during the migration window; required
// after the Phase 5 contract step.
ScoreCardCDFNegativeSchema.plugin(importProvenance);
ScoreCardCDFNegativeSchema.plugin(siteOwned, { sortField: "week", modelName: "ScoreCardCDFNegative" });

const ScoreCardCDFNegative: Model<IScoreCardCDFNegative> =
  mongoose.models.ScoreCardCDFNegative ||
  mongoose.model<IScoreCardCDFNegative>('ScoreCardCDFNegative', ScoreCardCDFNegativeSchema);

export default ScoreCardCDFNegative;
