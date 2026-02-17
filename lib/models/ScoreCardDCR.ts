import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IScoreCardDCR extends Document {
  week: string;
  deliveryAssociate: string;
  transporterId: string;
  dcr: number;
  packagesDelivered: number;
  packagesDispatched: number;
  packagesReturnedToStation: number;
  packagesReturnedDAControllable: number;
  rtsAllExempted: number;
  rtsBusinessClosed: number;
  rtsCustomerUnavailable: number;
  rtsNoSecureLocation: number;
  rtsOther: number;
  rtsOutOfDriveTime: number;
  rtsUnableToAccess: number;
  rtsUnableToLocate: number;
  rtsUnsafeDueToDog: number;
  rtsBadWeather: number;
  rtsLockerIssue: number;
  rtsMissingOrIncorrectAccessCode: number;
  rtsOtpNotAvailable: number;
  employeeId?: mongoose.Types.ObjectId;
}

const ScoreCardDCRSchema: Schema = new Schema({
  week: { type: String, required: true, index: true },
  deliveryAssociate: { type: String },
  transporterId: { type: String, required: true, index: true },
  dcr: { type: Number, default: 0 },
  packagesDelivered: { type: Number, default: 0 },
  packagesDispatched: { type: Number, default: 0 },
  packagesReturnedToStation: { type: Number, default: 0 },
  packagesReturnedDAControllable: { type: Number, default: 0 },
  rtsAllExempted: { type: Number, default: 0 },
  rtsBusinessClosed: { type: Number, default: 0 },
  rtsCustomerUnavailable: { type: Number, default: 0 },
  rtsNoSecureLocation: { type: Number, default: 0 },
  rtsOther: { type: Number, default: 0 },
  rtsOutOfDriveTime: { type: Number, default: 0 },
  rtsUnableToAccess: { type: Number, default: 0 },
  rtsUnableToLocate: { type: Number, default: 0 },
  rtsUnsafeDueToDog: { type: Number, default: 0 },
  rtsBadWeather: { type: Number, default: 0 },
  rtsLockerIssue: { type: Number, default: 0 },
  rtsMissingOrIncorrectAccessCode: { type: Number, default: 0 },
  rtsOtpNotAvailable: { type: Number, default: 0 },
  employeeId: { type: Schema.Types.ObjectId, ref: 'SymxEmployee' },
}, { timestamps: true, collection: 'ScoreCard_DCR' });

ScoreCardDCRSchema.index({ week: 1, transporterId: 1 }, { unique: true });

const ScoreCardDCR: Model<IScoreCardDCR> =
  mongoose.models.ScoreCardDCR ||
  mongoose.model<IScoreCardDCR>('ScoreCardDCR', ScoreCardDCRSchema);

export default ScoreCardDCR;
