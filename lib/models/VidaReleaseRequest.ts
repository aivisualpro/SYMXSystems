import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReleaseOrderProduct {
    product: mongoose.Types.ObjectId;
    qty: number;
    lotSerial: string;
}

export interface IVidaReleaseRequest extends Document {
  poNo: string; // Customer PO
  date: Date;
  warehouse: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId; // User
  customer: mongoose.Types.ObjectId;
  contact: string; // Selected location
  
  releaseOrderProducts: IReleaseOrderProduct[];

  carrier: string;
  requestedPickupTime: Date;
  scheduledPickupDate: Date;
  scheduledPickupTime: string;
  instructions: string;
  
  createdBy: string;
  createdAt: Date;
}

const ReleaseOrderProductSchema = new Schema({
    product: { type: Schema.Types.ObjectId, ref: 'VidaProduct', required: true },
    qty: { type: Number, required: true },
    lotSerial: { type: String }
});

const VidaReleaseRequestSchema: Schema = new Schema({
  poNo: { type: String, required: true },
  date: { type: Date, default: Date.now },
  warehouse: { type: Schema.Types.ObjectId, ref: 'VidaWarehouse', required: true },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'VidaUser' },
  customer: { type: Schema.Types.ObjectId, ref: 'VidaCustomer' },
  contact: { type: String },

  releaseOrderProducts: [ReleaseOrderProductSchema],

  carrier: { type: String },
  requestedPickupTime: { type: Date },
  scheduledPickupDate: { type: Date },
  scheduledPickupTime: { type: String },
  instructions: { type: String },

  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const VidaReleaseRequest: Model<IVidaReleaseRequest> = mongoose.models.VidaReleaseRequest || mongoose.model<IVidaReleaseRequest>('VidaReleaseRequest', VidaReleaseRequestSchema);

export default VidaReleaseRequest;
