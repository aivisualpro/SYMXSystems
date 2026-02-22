import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IScoreCardRTS extends Document {
  week: string;
  deliveryAssociate: string;
  trackingId: string;
  transporterId: string;
  impactDcr: string;
  rtsCode: string;
  customerContactDetails: string;
  plannedDeliveryDate: string;
  exemptionReason: string;
  serviceArea: string;
  employeeId?: mongoose.Types.ObjectId;
}

const ScoreCardRTSSchema: Schema = new Schema({
  week: { type: String, required: true, index: true },
  deliveryAssociate: { type: String, default: '' },
  trackingId: { type: String, default: '' },
  transporterId: { type: String, index: true },
  impactDcr: { type: String, default: '' },
  rtsCode: { type: String, default: '' },
  customerContactDetails: { type: String, default: '' },
  plannedDeliveryDate: { type: String, default: '' },
  exemptionReason: { type: String, default: '' },
  serviceArea: { type: String, default: '' },
  employeeId: { type: Schema.Types.ObjectId, ref: 'SymxEmployee' },
}, { timestamps: true, collection: 'ScoreCard_rts' });

// Unique: transporterId + trackingId to avoid duplicates
ScoreCardRTSSchema.index({ week: 1, transporterId: 1, trackingId: 1 }, { unique: true });

const ScoreCardRTS: Model<IScoreCardRTS> =
  mongoose.models.ScoreCardRTS ||
  mongoose.model<IScoreCardRTS>('ScoreCardRTS', ScoreCardRTSSchema);

export default ScoreCardRTS;
