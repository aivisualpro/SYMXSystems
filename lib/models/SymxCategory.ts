import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISymxCategory extends Document {
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

const SymxCategorySchema: Schema = new Schema({
  category: { type: String, required: true, unique: true },
  isOnWebsite: { type: Boolean, default: false },
  subcategories: [{
    _id: false,
    subcategory: { type: String, required: true },
    icon: String,
    isOnWebsite: { type: Boolean, default: false }
  }]
}, { timestamps: true });

const SymxCategory: Model<ISymxCategory> = mongoose.models.SymxCategory || mongoose.model<ISymxCategory>('SymxCategory', SymxCategorySchema);

export default SymxCategory;
