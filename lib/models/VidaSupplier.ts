import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaSupplierLocation {
  vbId: string;
  locationName?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  fullAddress?: string;
  website?: string;
  fdaReg?: string;
}

export interface IVidaSupplier extends Document {
  vbId: string;
  name: string;
  location: IVidaSupplierLocation[];
}

const VidaSupplierLocationSchema: Schema = new Schema({
  vbId: { type: String },
  locationName: { type: String },
  street: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  zip: { type: String },
  fullAddress: { type: String },
  website: { type: String },
  fdaReg: { type: String },
});

const VidaSupplierSchema: Schema = new Schema({
  vbId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: [VidaSupplierLocationSchema],
});

const VidaSupplier: Model<IVidaSupplier> = mongoose.models.VidaSupplier || mongoose.model<IVidaSupplier>('VidaSupplier', VidaSupplierSchema);

export default VidaSupplier;
