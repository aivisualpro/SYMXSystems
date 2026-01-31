import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaWarehouseContact {
  name: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  isPrimary: boolean;
}

export interface IVidaWarehouse extends Document {
  name: string;
  address: string;
  contacts: IVidaWarehouseContact[];
}

const VidaWarehouseContactSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  isActive: { type: Boolean, default: true },
  isPrimary: { type: Boolean, default: false },
});

const VidaWarehouseSchema: Schema = new Schema({
  name: { type: String, required: true },
  address: { type: String },
  contacts: [VidaWarehouseContactSchema],
});

const VidaWarehouse: Model<IVidaWarehouse> = mongoose.models.VidaWarehouse || mongoose.model<IVidaWarehouse>('VidaWarehouse', VidaWarehouseSchema);

export default VidaWarehouse;
