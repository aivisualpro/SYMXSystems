import mongoose, { Schema } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

const AmazonReportImportSchema = new Schema({
  fileName: { type: String, required: true },
  fileHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  reportType: { type: String, required: true },
  reportLabel: { type: String, required: true },
  periodType: { type: String, enum: ["Daily", "Weekly"], required: true },
  week: { type: String, default: null },
  dateStart: { type: String, default: null },
  dateEnd: { type: String, default: null },
  rowCount: { type: Number, required: true, min: 1 },
  impactingCount: { type: Number, required: true, min: 0 },
  insertedCount: { type: Number, default: 0, min: 0 },
  updatedCount: { type: Number, default: 0, min: 0 },
  processedCount: { type: Number, default: 0, min: 0 },
  skippedCount: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["pending", "success", "failed", "voided"], default: "pending", required: true },
  voidedAt: Date,
  voidedBy: String,
  removedRecordCount: Number,
  releasedRecordCount: Number,
  importedAt: { type: Date, default: Date.now, required: true },
  importedBy: { type: String, required: true },
  importedByName: { type: String },
  processingStartedAt: { type: Date },
  errorMessage: { type: String },
  versionKey: { type: String, required: true },
}, { timestamps: true, collection: "ScoreCard_AmazonReportImports" });

AmazonReportImportSchema.plugin(siteOwned, { sortField: "importedAt", modelName: "AmazonReportImport" });
AmazonReportImportSchema.path("siteId").required(true);
AmazonReportImportSchema.index({ siteId: 1, fileHash: 1, status: 1, importedAt: -1 });
AmazonReportImportSchema.index({ siteId: 1, periodType: 1, importedAt: -1 });
AmazonReportImportSchema.index({ siteId: 1, versionKey: 1, status: 1, importedAt: -1 });

const AmazonReportImport = mongoose.models.AmazonReportImport ||
  mongoose.model("AmazonReportImport", AmazonReportImportSchema);
export default AmazonReportImport;
