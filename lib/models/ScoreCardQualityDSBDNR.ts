import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IScoreCardQualityDSBDNR extends Document {
  week: string;
  deliveryAssociate: string;
  transporterId: string;
  dsbCount: number;
  dsbDpmo: number;
  attendedDeliveryCount: number;
  unattendedDeliveryCount: number;
  simultaneousDeliveries: number;
  deliveredOver50m: number;
  incorrectScanUsageAttended: number;
  incorrectScanUsageUnattended: number;
  noPodOnDelivery: number;
  scannedNotDeliveredNotReturned: number;
  employeeId?: mongoose.Types.ObjectId;
}

const ScoreCardQualityDSBDNRSchema: Schema = new Schema({
  week: { type: String, required: true, index: true },
  deliveryAssociate: { type: String },
  transporterId: { type: String, required: true, index: true },
  dsbCount: { type: Number, default: 0 },
  dsbDpmo: { type: Number, default: 0 },
  attendedDeliveryCount: { type: Number, default: 0 },
  unattendedDeliveryCount: { type: Number, default: 0 },
  simultaneousDeliveries: { type: Number, default: 0 },
  deliveredOver50m: { type: Number, default: 0 },
  incorrectScanUsageAttended: { type: Number, default: 0 },
  incorrectScanUsageUnattended: { type: Number, default: 0 },
  noPodOnDelivery: { type: Number, default: 0 },
  scannedNotDeliveredNotReturned: { type: Number, default: 0 },
  employeeId: { type: Schema.Types.ObjectId, ref: 'SymxEmployee' },
}, { timestamps: true, collection: 'ScoreCard_QualityDSBDNR' });

ScoreCardQualityDSBDNRSchema.index({ week: 1, transporterId: 1 }, { unique: true });

const ScoreCardQualityDSBDNR: Model<IScoreCardQualityDSBDNR> =
  mongoose.models.ScoreCardQualityDSBDNR ||
  mongoose.model<IScoreCardQualityDSBDNR>('ScoreCardQualityDSBDNR', ScoreCardQualityDSBDNRSchema);

export default ScoreCardQualityDSBDNR;
