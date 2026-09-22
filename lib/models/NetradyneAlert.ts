import mongoose, { Schema, Document, Model } from 'mongoose';
import { siteOwned } from "./plugins/site-owned";

/**
 * Log of every alert received from Netradyne's Alert Webhook (the fleet
 * safety camera system). Kept as a permanent audit trail — separate from
 * whether/how a driver was actually notified — so a disputed coaching
 * conversation ("I never got that alert") has a record to check against,
 * and so repeated webhook deliveries for status changes on the same alert
 * (Netradyne re-posts on status/video/driver-assignment updates) are
 * traceable.
 *
 * Netradyne severity scale (from their Alert Webhook docs):
 *   1 = ALERT (SEVERE)     2 = WARN (MODERATE)
 *   3 = DRIVER-STAR (positive recognition, not a violation)
 *   4 = NEUTRAL
 * Only severity 1/2 + status "CONFIRMED" trigger a push to the driver's
 * phone (see app/api/public/netradyne-webhook/route.ts) — this collection
 * stores everything received, including the ones that didn't page anyone,
 * so the full picture is queryable later.
 */
export interface INetradyneAlert extends Document {
  siteId?: mongoose.Types.ObjectId;
  netradyneAlertId: string;      // Netradyne's own alert `id`, for de-duping re-posts
  netradyneDriverId: string;
  transporterId?: string;        // Resolved SYMX employee, if a match was found
  driverName: string;            // Snapshot from the payload
  vehicleNumber?: string;
  vin?: string;
  severity?: number;
  severityDescription?: string;
  typeId?: number;
  typeDescription?: string;
  subTypeDescription?: string;
  status?: string;               // "CONFIRMED" | "REJECTED"
  timestamp?: Date;              // When Netradyne says the event occurred
  pushSent: boolean;             // Did we actually notify the driver's phone
  pushSkippedReason?: string;    // e.g. "no matching employee", "no fcm token", "severity below threshold"
  rawPayload: any;               // Full webhook body, for anything not modeled above
  createdAt: Date;
}

const NetradyneAlertSchema: Schema = new Schema({
  netradyneAlertId: { type: String, required: true, index: true },
  netradyneDriverId: { type: String, default: '' },
  transporterId: { type: String, index: true },
  driverName: { type: String, default: '' },
  vehicleNumber: { type: String, default: '' },
  vin: { type: String, default: '' },
  severity: { type: Number },
  severityDescription: { type: String, default: '' },
  typeId: { type: Number },
  typeDescription: { type: String, default: '' },
  subTypeDescription: { type: String, default: '' },
  status: { type: String, default: '' },
  timestamp: { type: Date },
  pushSent: { type: Boolean, default: false },
  pushSkippedReason: { type: String, default: '' },
  rawPayload: { type: Schema.Types.Mixed },
}, { timestamps: true, collection: 'NetradyneAlerts' });

NetradyneAlertSchema.index({ transporterId: 1, createdAt: -1 });

// ── Multi-site ──
// Stamped from the resolved driver's primarySiteId at the time the alert
// came in (immutable, like other site-owned records) — set directly on
// create() since the webhook has no user session to resolve scope from.
siteOwned(NetradyneAlertSchema, { sortField: "timestamp", modelName: "NetradyneAlert" });

const NetradyneAlert: Model<INetradyneAlert> =
  mongoose.models.NetradyneAlert ||
  mongoose.model<INetradyneAlert>('NetradyneAlert', NetradyneAlertSchema);

export default NetradyneAlert;
