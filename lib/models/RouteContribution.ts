import mongoose, { Schema, Model } from "mongoose";
import { siteOwned } from "./plugins/site-owned";

/**
 * Who actually delivered how much of each ROUTE on a day. One row per
 * (route, driver). A driver whose itinerary holds several routes (Cortex
 * "routes[]") gets one row per route — that is how rescues / hand-offs show up.
 */
export interface IRouteContribution {
  siteId?: mongoose.Types.ObjectId;
  date: string;              // YYYY-MM-DD (business day)
  routeCode: string;
  transporterId: string;
  itineraryId: string;
  itineraryRouteCode: string; // the driver's own itinerary label
  completedDeliveries: number;
  totalDeliveries: number;
  completedStops: number;
  totalStops: number;
  onRoadPickups?: number;
  plannedDepartureTime?: number;
}

const RouteContributionSchema = new Schema(
  {
    date: { type: String, required: true },
    routeCode: { type: String, required: true },
    transporterId: { type: String, required: true },
    itineraryId: { type: String, default: "" },
    itineraryRouteCode: { type: String, default: "" },
    completedDeliveries: { type: Number, default: 0 },
    totalDeliveries: { type: Number, default: 0 },
    completedStops: { type: Number, default: 0 },
    totalStops: { type: Number, default: 0 },
    onRoadPickups: { type: Number, default: 0 },
    plannedDepartureTime: { type: Number },
  },
  { timestamps: true, collection: "SYMXRouteContributions" }
);

siteOwned(RouteContributionSchema, { sortField: "date", modelName: "RouteContribution" });
RouteContributionSchema.index({ siteId: 1, date: 1, routeCode: 1, transporterId: 1 }, { unique: true });

const RouteContribution: Model<IRouteContribution> =
  mongoose.models.RouteContribution || mongoose.model<IRouteContribution>("RouteContribution", RouteContributionSchema);
export default RouteContribution;
