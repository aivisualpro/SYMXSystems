import mongoose, { Model, Schema } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

export interface IDriverPerformanceLink {
  siteId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  token: string;
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const DriverPerformanceLinkSchema = new Schema<IDriverPerformanceLink>({
  employeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee", required: true, index: true },
  token: { type: String, required: true, unique: true, select: false, minlength: 40 },
  active: { type: Boolean, default: true, required: true, index: true },
  createdBy: { type: String, required: true },
}, { timestamps: true, collection: "DriverPerformanceLinks" });

DriverPerformanceLinkSchema.index({ siteId: 1, employeeId: 1 }, { unique: true });
DriverPerformanceLinkSchema.plugin(siteOwned, { modelName: "DriverPerformanceLink" });
DriverPerformanceLinkSchema.path("siteId").required(true);

const DriverPerformanceLink: Model<IDriverPerformanceLink> =
  mongoose.models.DriverPerformanceLink || mongoose.model<IDriverPerformanceLink>("DriverPerformanceLink", DriverPerformanceLinkSchema);

export default DriverPerformanceLink;
