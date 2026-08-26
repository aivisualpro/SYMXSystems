import mongoose, { Schema, Document, Model } from "mongoose";

// ── Multi-site: Site ──────────────────────────────────────────────────
// An operating location. Every piece of operational data (routes,
// schedules, inspections, write-ups, HR records, scorecards) is owned by
// exactly one Site, and that ownership is immutable once written — a
// record belongs forever to the site that produced it, even if the
// employee or vehicle involved later transfers elsewhere.
//
// Deliberately NOT on this model:
//   • `timezone` — all sites are in California; timezone lives on
//     Organization. Adding it here would invite per-site drift for no
//     current benefit.
//   • `state` — same reason. California labor rules (daily/weekly OT,
//     meal waivers) apply org-wide, so the timecard audit stays
//     org-level rather than becoming a per-site rules engine.
//
// Sites are never hard-coded anywhere. Code that needs "the current
// sites" reads this collection; adding a fourth site is inserting a row.

export type SiteType = "permanent" | "seasonal";

export interface ISite extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  code: string;
  siteType: SiteType;
  address: string;
  status: "active" | "inactive";
  isDefault: boolean;
  messaging?: {
    quoPhoneNumberId?: string;
    quoPhoneNumber?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SiteSchema: Schema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true },
    // URL-safe identifier used in deep links and the ?site= query param.
    slug: { type: String, required: true, index: true },
    // Short human-facing code for tables, exports, and printed PDFs.
    // In practice this is the Amazon station code (DFO2, DXC8, DFO3).
    code: { type: String, default: "" },
    // Seasonal sites (peak-season stations) open and close. The open/closed
    // state itself is `status` below — this field records the site's NATURE,
    // which matters for reporting: a year-over-year comparison that silently
    // includes a station that only ran for ten weeks is misleading, so
    // reports can choose to separate or annotate seasonal sites.
    // Closing a seasonal site sets status:"inactive"; it is never deleted,
    // so its history stays queryable and its records keep their ownership.
    siteType: { type: String, enum: ["permanent", "seasonal"], default: "permanent", index: true },
    address: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    // Exactly one site carries isDefault. During the migration it is the
    // site every pre-existing record is backfilled to, and the fallback
    // any legacy code path resolves to while the compatibility shim is
    // still in place. A site is never deleted — closing one sets
    // status: "inactive" so its history stays queryable.
    isDefault: { type: Boolean, default: false, index: true },
    // ── Per-station messaging (Quo / OpenPhone) ──
    // Each station texts drivers from its own number, so the number is a
    // property of the station rather than a single environment variable.
    //
    // This is what makes the number authoritative in both directions:
    //   outbound — the sending number is derived from the station that
    //              owns the schedule being messaged about, never taken
    //              from the request body. Otherwise a DXC8 user could
    //              send as DFO2 by passing a different id.
    //   inbound  — the Quo webhook is unauthenticated and carries no
    //              station, so the `to` number is the ONLY way to know
    //              which station a reply belongs to.
    //
    // quoPhoneNumberId is OpenPhone's PNxxxxxxxx handle (what the API
    // wants); quoPhoneNumber is the human-readable E.164 number (what the
    // webhook reports and what a person recognises). Both are stored
    // because each side of the integration speaks a different one.
    // No `default: ""` on either field. An empty-string default would make
    // the field always present, which defeats the sparse unique indexes
    // below — every unconfigured station would collide with every other.
    // Unset means absent.
    messaging: {
      quoPhoneNumberId: { type: String },
      quoPhoneNumber: { type: String },
    },
  },
  { timestamps: true, collection: "SYMXSites" }
);

// Reverse lookup for the inbound webhook: number -> station.
//
// UNIQUE, because the number is the only evidence of which station an
// inbound reply belongs to. If two stations shared one, resolving it would
// return whichever document came back first and quietly file drivers'
// replies under the wrong station. Better to make that state impossible
// than to detect it later.
//
// SPARSE so stations with no number configured don't all collide on
// "missing" — which is why neither field has an empty-string default.
//
// sparse and partialFilterExpression cannot be combined (MongoDB rejects
// the spec outright), and $ne is not permitted inside a partial filter, so
// sparse alone is the correct tool here.
SiteSchema.index({ "messaging.quoPhoneNumberId": 1 }, { unique: true, sparse: true });
SiteSchema.index({ "messaging.quoPhoneNumber": 1 }, { unique: true, sparse: true });

// Slug is unique per organization, not globally — the org boundary is the
// real namespace even though there is only one org today.
SiteSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
SiteSchema.index({ organizationId: 1, status: 1 });

const Site: Model<ISite> = mongoose.models.Site || mongoose.model<ISite>("Site", SiteSchema);

export default Site;
