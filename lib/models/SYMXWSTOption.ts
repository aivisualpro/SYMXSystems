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
  /** Revenue per hour for this service line at this station. */
  revenue: number;
}

export interface ISYMXWSTOption extends Document {
  wst: string;
  /**
   * Fallback revenue, used when a station has no rate of its own.
   *
   * Kept because every existing record already has one and dropping it
   * would zero out revenue at any station not yet configured. A station
   * with no rate should fall back to something plausible rather than
   * silently valuing the work at nothing.
   */
  revenue: number;
  /** Per-station overrides. Empty means every station uses `revenue`. */
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
        revenue: { type: Number, required: true },
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

/**
 * The revenue for this WST option at a given station.
 *
 * Falls back to the shared `revenue` when the station has no rate of its
 * own — a station that has not been configured yet should price work at
 * the default rather than at zero, because zero flows silently into
 * revenue and cost-per-route figures that still look like numbers.
 */
export function wstRevenueFor(
  option: { revenue?: number; rates?: IWSTStationRate[] } | null | undefined,
  siteId: string | mongoose.Types.ObjectId | null | undefined
): number {
  if (!option) return 0;
  if (siteId && Array.isArray(option.rates)) {
    const hit = option.rates.find((r) => String(r.siteId) === String(siteId));
    if (hit && typeof hit.revenue === "number") return hit.revenue;
  }
  return option.revenue ?? 0;
}

const SYMXWSTOption: Model<ISYMXWSTOption> =
  mongoose.models.SYMXWSTOption ||
  mongoose.model<ISYMXWSTOption>("SYMXWSTOption", SYMXWSTOptionSchema);

export default SYMXWSTOption;
