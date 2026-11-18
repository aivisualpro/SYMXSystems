import mongoose, { Schema } from "mongoose";
import { siteOwned } from "./plugins/site-owned";
const schema = new Schema(
  {
    captureId: { type: String, required: true },
    date: { type: String, required: true },
    station: { type: String, required: true },
    routeCode: { type: String, required: true },
    driverId: { type: String, default: "" },
    routeId: String,
    driverName: String,
    totalStops: Number,
    completedStops: Number,
    totalPackages: Number,
    completedPackages: Number,
    plannedDeparture: Number,
    actualDeparture: Number,
    plannedReturn: Number,
    actualReturn: Number,
    firstDelivery: Number,
    lastDelivery: Number,
    inboundMinutes: Number,
    detail: Boolean,
    observedAt: { type: Date, required: true },
    receivedAt: { type: Date, default: Date.now },
  },
  { collection: "SYMXCortexObservations", autoIndex: true },
);
siteOwned(schema, { sortField: "date", modelName: "CortexObservation" });
schema.index(
  { siteId: 1, captureId: 1, routeCode: 1, driverId: 1 },
  { unique: true },
);
schema.index({ receivedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 35 });
schema.index({ siteId: 1, date: 1, observedAt: -1 });
export default mongoose.models.CortexObservation ||
  mongoose.model("CortexObservation", schema);
