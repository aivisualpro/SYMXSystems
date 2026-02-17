
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISymxCustomerDeliveryFeedback extends Document {
  week: string;
  transporterId: string;
  employeeId?: mongoose.Types.ObjectId; // Reference to SymxEmployee
  
  deliveryAssociate?: string;
  
  cdfDpmo?: number;
  cdfDpmoTier?: string;
  cdfDpmoScore?: number;
  
  negativeFeedbackCount?: number;
}

const SymxCustomerDeliveryFeedbackSchema: Schema = new Schema({
  week: { type: String, required: true },
  transporterId: { type: String, required: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'SymxEmployee' },

  deliveryAssociate: { type: String },

  cdfDpmo: { type: Number },
  cdfDpmoTier: { type: String },
  cdfDpmoScore: { type: Number },
  
  negativeFeedbackCount: { type: Number, default: 0 },

}, { timestamps: true, collection: 'ScoreCard_CustomerDeliveryFeedback' });

// Compound index for uniqueness on Week + Transporter ID
SymxCustomerDeliveryFeedbackSchema.index({ week: 1, transporterId: 1 }, { unique: true });

const SymxCustomerDeliveryFeedback: Model<ISymxCustomerDeliveryFeedback> = mongoose.models.SymxCustomerDeliveryFeedback || mongoose.model<ISymxCustomerDeliveryFeedback>('SymxCustomerDeliveryFeedback', SymxCustomerDeliveryFeedbackSchema);

export default SymxCustomerDeliveryFeedback;
