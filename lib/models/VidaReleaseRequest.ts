import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaReleaseRequest extends Document {
  poNo: string;
  product: mongoose.Types.ObjectId;
  stockingQty: number;
  trackingQty: number;
  location: string;
  lotNo: string;
  serial: string;
  expiryDate?: Date;
  warehouse: mongoose.Types.ObjectId;
  createdBy: string;
  createdAt: Date;
}

const VidaReleaseRequestSchema: Schema = new Schema({
  poNo: { type: String, required: true },
  product: { type: Schema.Types.ObjectId, ref: 'VidaProduct', required: true },
  stockingQty: { type: Number, required: true },
  trackingQty: { type: Number, required: true },
  location: { type: String },
  lotNo: { type: String },
  serial: { type: String },
  expiryDate: { type: Date },
  warehouse: { type: Schema.Types.ObjectId, ref: 'VidaWarehouse', required: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const VidaReleaseRequest: Model<IVidaReleaseRequest> = mongoose.models.VidaReleaseRequest || mongoose.model<IVidaReleaseRequest>('VidaReleaseRequest', VidaReleaseRequestSchema);

export default VidaReleaseRequest;
