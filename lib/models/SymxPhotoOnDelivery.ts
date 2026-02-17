
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISymxPhotoOnDelivery extends Document {
  week: string;
  transporterId: string;
  employeeId?: mongoose.Types.ObjectId; // Reference to SymxEmployee
  
  firstName?: string;
  lastName?: string;
  
  opportunities?: number;
  success?: number;
  bypass?: number;
  rejects?: number;
  
  blurryPhoto?: number;
  humanInThePicture?: number;
  noPackageDetected?: number;
  packageInCar?: number;
  packageInHand?: number;
  packageNotClearlyVisible?: number;
  packageTooClose?: number;
  photoTooDark?: number;
  other?: number;
}

const SymxPhotoOnDeliverySchema: Schema = new Schema({
  week: { type: String, required: true },
  transporterId: { type: String, required: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'SymxEmployee' },

  firstName: { type: String },
  lastName: { type: String },

  opportunities: { type: Number, default: 0 },
  success: { type: Number, default: 0 },
  bypass: { type: Number, default: 0 },
  rejects: { type: Number, default: 0 },

  blurryPhoto: { type: Number, default: 0 },
  humanInThePicture: { type: Number, default: 0 },
  noPackageDetected: { type: Number, default: 0 },
  packageInCar: { type: Number, default: 0 },
  packageInHand: { type: Number, default: 0 },
  packageNotClearlyVisible: { type: Number, default: 0 },
  packageTooClose: { type: Number, default: 0 },
  photoTooDark: { type: Number, default: 0 },
  other: { type: Number, default: 0 },

}, { timestamps: true, collection: 'ScoreCard_PhotoOnDelivery' });

// Compound index for uniqueness on Week + Transporter ID
SymxPhotoOnDeliverySchema.index({ week: 1, transporterId: 1 }, { unique: true });

// Prevent overwrite error in dev hot reloading
const SymxPhotoOnDelivery: Model<ISymxPhotoOnDelivery> = mongoose.models.SymxPhotoOnDelivery || mongoose.model<ISymxPhotoOnDelivery>('SymxPhotoOnDelivery', SymxPhotoOnDeliverySchema);

export default SymxPhotoOnDelivery;
