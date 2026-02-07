import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISymxWarehouseContact {
  name: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  isPrimary: boolean;
}

export interface ISymxWarehouse extends Document {
  name: string;
  address: string;
  contacts: ISymxWarehouseContact[];
}

const SymxWarehouseContactSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  isActive: { type: Boolean, default: true },
  isPrimary: { type: Boolean, default: false },
});

const SymxWarehouseSchema: Schema = new Schema({
  name: { type: String, required: true },
  address: { type: String },
  contacts: [SymxWarehouseContactSchema],
});

const SymxWarehouse: Model<ISymxWarehouse> = mongoose.models.SymxWarehouse || mongoose.model<ISymxWarehouse>('SymxWarehouse', SymxWarehouseSchema);

export default SymxWarehouse;
