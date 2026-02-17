import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IScoreCardRemarksHistory {
  action: 'created' | 'updated';
  changedFields: string[];
  changedBy: {
    userId: string;
    name: string;
  };
  changedAt: Date;
}

export interface ISymxScoreCardRemarks extends Document {
  transporterId: string;
  week: string;
  driverRemarks?: string;
  driverSignature?: string;        // base64 data URL of the signature image
  driverSignatureTimestamp?: Date;
  managerRemarks?: string;
  managerSignature?: string;       // base64 data URL of the signature image
  managerSignatureTimestamp?: Date;
  managerId?: mongoose.Types.ObjectId;
  managerName?: string;
  history?: IScoreCardRemarksHistory[];
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
  managerId: { type: Schema.Types.ObjectId, ref: 'SymxUser' },
  managerName: { type: String, default: '' },
  history: [{
    action: { type: String, enum: ['created', 'updated'], required: true },
    changedFields: [{ type: String }],
    changedBy: {
      userId: { type: String, required: true },
      name: { type: String, required: true },
    },
    changedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true, collection: 'ScoreCardRemarks' });

// Compound unique index: one record per driver per week
SymxScoreCardRemarksSchema.index({ transporterId: 1, week: 1 }, { unique: true });

const SymxScoreCardRemarks: Model<ISymxScoreCardRemarks> =
  mongoose.models.SymxScoreCardRemarks ||
  mongoose.model<ISymxScoreCardRemarks>('SymxScoreCardRemarks', SymxScoreCardRemarksSchema);

export default SymxScoreCardRemarks;
