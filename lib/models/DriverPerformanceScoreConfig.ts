import mongoose, { Schema } from "mongoose";
import { SCORE_CATEGORIES } from "@/lib/scorecard/performance-score-config";

const category = new Schema({
  category: { type: String, enum: SCORE_CATEGORIES, required: true, immutable: true },
  enabled: { type: Boolean, default: false, required: true, immutable: true },
  weight: { type: Number, default: null, min: 0, max: 100, immutable: true },
  minimumDataCoverage: { type: Number, default: null, min: 0, max: 100, immutable: true },
}, { _id: false });
const schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, immutable: true },
  scopeType: { type: String, enum: ["COMPANY", "SITE"], required: true, immutable: true },
  siteId: { type: Schema.Types.ObjectId, ref: "Site", default: null, immutable: true },
  version: { type: Number, required: true, min: 1, immutable: true },
  effectiveDate: { type: Date, default: null, immutable: true },
  active: { type: Boolean, default: false, required: true, immutable: true },
  categories: { type: [category], required: true, immutable: true },
  weights: { type: Schema.Types.Mixed, default: null, immutable: true },
  modifiers: { type: Schema.Types.Mixed, default: null, immutable: true },
  exposure: { type: Schema.Types.Mixed, default: null, immutable: true },
  workload: { type: Schema.Types.Mixed, default: null, immutable: true },
  effectiveFromWeek: { type: String, default: null, immutable: true },
  previousVersion: { type: Number, default: null, immutable: true },
  createdBy: { type: String, required: true, immutable: true },
  updatedBy: { type: String, default: null, immutable: true },
}, { timestamps: true, collection: "DriverPerformanceScoreConfigs", autoIndex: false, autoCreate: false });
schema.path("siteId").validate(function(this: any, value: unknown) {
  return this.scopeType === "SITE" ? value != null : value == null;
}, "Site scope requires one site; company scope cannot contain a site.");
schema.path("categories").validate((items: any[]) => items.length === SCORE_CATEGORIES.length &&
  new Set(items.map(item => item.category)).size === SCORE_CATEGORIES.length &&
  items.every(item => SCORE_CATEGORIES.includes(item.category)), "Each scoring category must appear exactly once.");
schema.index({ organizationId: 1, scopeType: 1, siteId: 1, version: 1 }, { unique: true });

export default mongoose.models.DriverPerformanceScoreConfig ||
  mongoose.model("DriverPerformanceScoreConfig", schema);
