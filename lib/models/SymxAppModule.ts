import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISubModule {
  name: string;
  url: string;
}

export interface ISymxAppModule extends Document {
  name: string;
  url: string;
  icon: string; // icon name string e.g. "IconDashboard"
  order: number;
  subModules: ISubModule[];
  createdAt: Date;
  updatedAt: Date;
}

const SubModuleSchema = new Schema({
  name: { type: String, required: true },
  url: { type: String, default: "#" },
}, { _id: false });

const SymxAppModuleSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  url: { type: String, default: "#" },
  icon: { type: String, default: "IconDashboard" },
  order: { type: Number, default: 0 },
  subModules: { type: [SubModuleSchema], default: [] },
}, {
  timestamps: true,
  bufferCommands: true,
});

const SymxAppModule: Model<ISymxAppModule> = mongoose.models.SymxAppModule || mongoose.model<ISymxAppModule>('SymxAppModule', SymxAppModuleSchema);

export default SymxAppModule;
