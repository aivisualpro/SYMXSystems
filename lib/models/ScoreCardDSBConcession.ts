import mongoose, { Document, Model, Schema } from "mongoose";
import { siteOwned } from "./plugins/site-owned";
import { importProvenance } from "./plugins/import-provenance";

export interface IScoreCardDSBConcession extends Document {
  sourceImportIds?: mongoose.Types.ObjectId[];
  siteId?: mongoose.Types.ObjectId;
  disputeStatus?: string;
  action?: string;
  serviceArea?: string;
  dsp?: string;
  week: string;
  driverName: string;
  transporterId: string;
  trackingId: string;
  deliveryType: string;
  deliveryDate: string;
  concessionDate: string;
  impactsScorecard: string;
  simultaneousDeliveries: boolean;
  deliveredOver50m: boolean;
  incorrectScanUsageAttended: boolean;
  incorrectScanUsageUnattended: boolean;
  noPodOnDelivery: boolean;
  scannedNotDeliveredNotReturned: boolean;
  employeeId?: mongoose.Types.ObjectId;
}

const ScoreCardDSBConcessionSchema = new Schema<IScoreCardDSBConcession>({
  disputeStatus: { type: String },
  action: { type: String },
  serviceArea: { type: String },
  dsp: { type: String },
  week: { type: String, required: true, index: true },
  driverName: { type: String, default: "" },
  transporterId: { type: String, required: true, index: true },
  trackingId: { type: String, required: true, index: true },
  deliveryType: { type: String, default: "" },
  deliveryDate: { type: String, default: "" },
  concessionDate: { type: String, required: true, index: true },
  impactsScorecard: { type: String, default: "" },
  simultaneousDeliveries: { type: Boolean, default: false },
  deliveredOver50m: { type: Boolean, default: false },
  incorrectScanUsageAttended: { type: Boolean, default: false },
  incorrectScanUsageUnattended: { type: Boolean, default: false },
  noPodOnDelivery: { type: Boolean, default: false },
  scannedNotDeliveredNotReturned: { type: Boolean, default: false },
  employeeId: { type: Schema.Types.ObjectId, ref: "SymxEmployee" },
}, { timestamps: true, collection: "ScoreCard_DSBConcessions" });

ScoreCardDSBConcessionSchema.index(
  { siteId: 1, transporterId: 1, trackingId: 1, concessionDate: 1 },
  { unique: true },
);
ScoreCardDSBConcessionSchema.plugin(importProvenance);
ScoreCardDSBConcessionSchema.plugin(siteOwned, {
  sortField: "concessionDate",
  modelName: "ScoreCardDSBConcession",
});

const ScoreCardDSBConcession: Model<IScoreCardDSBConcession> =
  mongoose.models.ScoreCardDSBConcession ||
  mongoose.model<IScoreCardDSBConcession>("ScoreCardDSBConcession", ScoreCardDSBConcessionSchema);

export default ScoreCardDSBConcession;
