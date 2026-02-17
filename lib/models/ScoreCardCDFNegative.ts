import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IScoreCardCDFNegative extends Document {
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
}, { timestamps: true, collection: 'ScoreCard_CDF_Negative' });

ScoreCardCDFNegativeSchema.index({ week: 1, deliveryAssociate: 1, trackingId: 1 }, { unique: true });

const ScoreCardCDFNegative: Model<IScoreCardCDFNegative> =
  mongoose.models.ScoreCardCDFNegative ||
  mongoose.model<IScoreCardCDFNegative>('ScoreCardCDFNegative', ScoreCardCDFNegativeSchema);

export default ScoreCardCDFNegative;
