import mongoose, { Schema, Model } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

/** One row per driver per day: pace vs plan, breaks, delivery quality, areas. Written by the Cortex itinerary sync. */
const AreaSchema = new Schema({ zip: String, city: String, stops: Number, packages: Number, deltaSum: Number }, { _id: false });

const RouteDayStatsSchema = new Schema(
  {
    date: { type: String, required: true },
    transporterId: { type: String, required: true },
    itineraryId: { type: String, default: "" },
    routeCode: { type: String, default: "" },
    stops: Number, packages: Number,
    firstActual: Number, lastActual: Number,
    stopsPerHour: Number, avgGapMin: Number, medianGapMin: Number,
    avgDeltaMin: Number, endDeltaMin: Number, worstDeltaMin: Number, onTimePct: Number,
    shiftHours: Number,
    mealStartMin: Number, mealMinutes: Number, mealAfterStop: Number, mealFlag: String,
    restCount: Number, restExpected: Number, restFlag: String,
    deliveredBy: { type: Schema.Types.Mixed, default: {} },
    notDelivered: Number, pickupFailed: Number,
    areas: { type: [AreaSchema], default: [] },
  },
  { timestamps: true, collection: "SYMXRouteDayStats" }
);

siteOwned(RouteDayStatsSchema, { sortField: "date", modelName: "RouteDayStats" });
RouteDayStatsSchema.index({ siteId: 1, date: 1, transporterId: 1 }, { unique: true });

const RouteDayStats: Model<any> = mongoose.models.RouteDayStats || mongoose.model("RouteDayStats", RouteDayStatsSchema);
export default RouteDayStats;
