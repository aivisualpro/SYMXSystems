import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISymxScoreCardRemarks extends Document {
  transporterId: string;
  week: string;
  driverRemarks?: string;
  driverSignature?: string;        // base64 data URL of the signature image
  driverSignatureTimestamp?: Date;
  managerRemarks?: string;
  managerSignature?: string;       // base64 data URL of the signature image
  managerSignatureTimestamp?: Date;
}

const SymxScoreCardRemarksSchema: Schema = new Schema({
  transporterId: { type: String, required: true },
  week: { type: String, required: true },
  driverRemarks: { type: String, default: '' },
  driverSignature: { type: String, default: '' },
  driverSignatureTimestamp: { type: Date },
  managerRemarks: { type: String, default: '' },
  managerSignature: { type: String, default: '' },
  managerSignatureTimestamp: { type: Date },
}, { timestamps: true, collection: 'SymxScoreCardRemarks' });

// Compound unique index: one record per driver per week
SymxScoreCardRemarksSchema.index({ transporterId: 1, week: 1 }, { unique: true });

const SymxScoreCardRemarks: Model<ISymxScoreCardRemarks> =
  mongoose.models.SymxScoreCardRemarks ||
  mongoose.model<ISymxScoreCardRemarks>('SymxScoreCardRemarks', SymxScoreCardRemarksSchema);

export default SymxScoreCardRemarks;
