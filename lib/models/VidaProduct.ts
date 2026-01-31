import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaProduct extends Document {
  vbId: string;
  name: string;
}

const VidaProductSchema: Schema = new Schema({
  vbId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
});

const VidaProduct: Model<IVidaProduct> = mongoose.models.VidaProduct || mongoose.model<IVidaProduct>('VidaProduct', VidaProductSchema);

export default VidaProduct;
