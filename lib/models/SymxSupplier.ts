import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISymxSupplierLocation {
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

export interface ISymxSupplier extends Document {
  vbId: string;
  name: string;
  location: ISymxSupplierLocation[];
}

const SymxSupplierLocationSchema: Schema = new Schema({
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

const SymxSupplierSchema: Schema = new Schema({
  vbId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: [SymxSupplierLocationSchema],
});

const SymxSupplier: Model<ISymxSupplier> = mongoose.models.SymxSupplier || mongoose.model<ISymxSupplier>('SymxSupplier', SymxSupplierSchema);

export default SymxSupplier;
