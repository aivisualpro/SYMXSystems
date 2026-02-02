import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaCategory extends Document {
  category: string;
  isOnWebsite: boolean;
  subcategories: {
    subcategory: string;
    icon?: string;
    isOnWebsite: boolean;
  }[];
  createdAt?: Date;
  updatedAt?: Date;
}

const VidaCategorySchema: Schema = new Schema({
  category: { type: String, required: true, unique: true },
  isOnWebsite: { type: Boolean, default: false },
  subcategories: [{
    _id: false,
    subcategory: { type: String, required: true },
    icon: String,
    isOnWebsite: { type: Boolean, default: false }
  }]
}, { timestamps: true });

const VidaCategory: Model<IVidaCategory> = mongoose.models.VidaCategory || mongoose.model<IVidaCategory>('VidaCategory', VidaCategorySchema);

export default VidaCategory;
