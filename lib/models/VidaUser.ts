import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVidaUser extends Document {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  address?: string;
  AppRole: 'Super Admin' | 'Manager';
  profilePicture?: string;
  isActive: boolean;
}

const VidaUserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  phone: { type: String },
  address: { type: String },
  AppRole: { 
    type: String, 
    enum: ['Super Admin', 'Manager'],
    required: true,
    default: 'Manager'
  },
  profilePicture: { type: String },
  isActive: { type: Boolean, default: true },
});

const VidaUser: Model<IVidaUser> = mongoose.models.VidaUser || mongoose.model<IVidaUser>('VidaUser', VidaUserSchema);

export default VidaUser;
