import mongoose, { Schema, Document, Model } from "mongoose";

// ── WST options: shared catalogue, per-station rate ───────────────────
//
// The list of WST selections is the SAME at every station — the work is
// the same work, and a dispatcher picking "Standard Parcel" means the
// same thing at DFO2 as at DXC8. What differs is the revenue: Amazon's
// rate cards price the identical service line differently per station
// ($38.70 at Oakley, $39.80 at San Jose, $36.20 at Livermore).
//
// So this is deliberately NOT site-owned. Cloning the catalogue per
// station would mean adding a new WST option three times and letting the
// three copies drift, and a dispatcher at one station could end up with
// selections another does not have.
//
// Instead the option is org-wide and carries a rate PER STATION. Reads
// happen in a station context, so the rate is resolved with
// wstRevenueFor(option, siteId) rather than being read off the document.

export interface IWSTStationRate {
  siteId: mongoose.Types.ObjectId;
  /**
   * Hourly rate for a route scheduled 1–8 hours.
   *
   * Amazon's rate cards give two columns per service line, and which one
   * applies is decided by the SCHEDULED duration of the route, not by
   * anything about the WST itself. A 4-hour route bills at `standard`.
   */
  standard: number;
  /**
   * Hourly rate for a route scheduled OVER 8 hours. A 9- or 10-hour route
   * bills every hour at this rate, not just the hours past the eighth.
   */
  over8: number;
}

export interface ISYMXWSTOption extends Document {
  wst: string;
  /**
   * Legacy single rate, from before rates were per station and per tier.
   *
   * Kept for one reason: a station with no rate configured yet must not
   * silently value its work at zero, because zero flows into revenue and
   * cost-per-route figures that still look like numbers. It is no longer
   * shown or edited anywhere — see migration 09, which seeds it into
   * rates[] — and can be dropped once every station is configured.
   */
  revenue: number;
  /** Per-station, per-tier rates. This is the real pricing. */
  rates: IWSTStationRate[];
  amazonServiceType: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const SYMXWSTOptionSchema = new Schema<ISYMXWSTOption>(
  {
    // Unique again, and globally this time — the catalogue is shared, so
    // one WST code means one option company-wide.
    wst: { type: String, required: true, unique: true },
    revenue: { type: Number, default: 0 },
    rates: [
      {
        _id: false,
        siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
        standard: { type: Number, default: 0 },
        over8: { type: Number, default: 0 },
      },
    ],
    amazonServiceType: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "SYMXWSTOptions" }
);

// Lookup by station when pricing a route.
SYMXWSTOptionSchema.index({ "rates.siteId": 1 });

/** Routes scheduled beyond this many hours bill at the higher tier. */
export const OVER8_THRESHOLD_HOURS = 8;

/**
 * The hourly rate for this WST at a station, for a route of a given
 * scheduled duration.
 *
 * Which tier applies is decided by the DURATION, not by the WST: the same
 * service line bills at one rate for a 4-hour route and a higher one for a
 * 9-hour route. Over 8 hours means EVERY hour bills at the higher rate,
 * not just the hours past the eighth — that is how the rate card reads
 * ("Routes Scheduled for Over 8 hrs"), and treating it as a marginal rate
 * would understate revenue on every long route.
 *
 * Falls back to the legacy flat rate when a station has none configured,
 * so an unconfigured station prices work at something plausible rather
 * than at zero.
 */
export function wstRateFor(
  option: { revenue?: number; rates?: IWSTStationRate[] } | null | undefined,
  siteId: string | mongoose.Types.ObjectId | null | undefined,
  durationHours: number
): number {
  if (!option) return 0;
  const tier = (durationHours || 0) > OVER8_THRESHOLD_HOURS ? "over8" : "standard";

  if (siteId && Array.isArray(option.rates)) {
    const hit = option.rates.find((r) => String(r.siteId) === String(siteId));
    if (hit) {
      const v = hit[tier];
      if (typeof v === "number" && v > 0) return v;
      // Only one tier filled in: use it rather than falling all the way
      // back to the legacy rate, which is likely staler.
      const other = tier === "over8" ? hit.standard : hit.over8;
      if (typeof other === "number" && other > 0) return other;
    }
  }
  return option.revenue ?? 0;
}

/** Total revenue for a route: hourly rate × scheduled hours. */
export function wstRevenueForRoute(
  option: { revenue?: number; rates?: IWSTStationRate[] } | null | undefined,
  siteId: string | mongoose.Types.ObjectId | null | undefined,
  durationHours: number
): number {
  const rate = wstRateFor(option, siteId, durationHours);
  return Math.round(rate * (durationHours || 0) * 100) / 100;
}

const SYMXWSTOption: Model<ISYMXWSTOption> =
  mongoose.models.SYMXWSTOption ||
  mongoose.model<ISYMXWSTOption>("SYMXWSTOption", SYMXWSTOptionSchema);

export default SYMXWSTOption;
