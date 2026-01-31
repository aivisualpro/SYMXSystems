import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaCustomerLocation {
  vbId: string;
  locationName?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  fullAddress?: string;
  website?: string;
  imageUrl?: string;
}

export interface IVidaCustomer extends Document {
  vbId: string;
  name: string;
  location: IVidaCustomerLocation[];
}

const VidaCustomerLocationSchema: Schema = new Schema({
  vbId: { type: String },
  locationName: { type: String },
  street: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  zip: { type: String },
  fullAddress: { type: String },
  website: { type: String },
  imageUrl: { type: String },
});

const VidaCustomerSchema: Schema = new Schema({
  vbId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: [VidaCustomerLocationSchema],
});

const VidaCustomer: Model<IVidaCustomer> = mongoose.models.VidaCustomer || mongoose.model<IVidaCustomer>('VidaCustomer', VidaCustomerSchema);

export default VidaCustomer;
