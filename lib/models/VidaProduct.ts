import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaProduct extends Document {
  vbId: string;
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  relatedProducts?: string[];
  tags?: string[];
  costPrice?: number;
  salePrice?: number;
  coverImage?: string;
  primaryImage?: string;
  showCase?: string[];
  otherInfo?: {
    title: string;
    tags: string[];
  }[];
  isOnWebsite?: boolean;
  sNo?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const VidaProductSchema: Schema = new Schema({
  vbId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String },
  subcategory: { type: String },
  relatedProducts: [{ type: Schema.Types.ObjectId, ref: 'VidaProduct' }],
  tags: [String],
  costPrice: { type: Number },
  salePrice: { type: Number },
  coverImage: { type: String },
  primaryImage: { type: String },
  showCase: [String],
  otherInfo: [{
    _id: false,
    title: String,
    tags: [String]
  }],
  isOnWebsite: { type: Boolean, default: false },
  sNo: { type: String }
}, { timestamps: true });

const VidaProduct: Model<IVidaProduct> = mongoose.models.VidaProduct || mongoose.model<IVidaProduct>('VidaProduct', VidaProductSchema);

export default VidaProduct;
