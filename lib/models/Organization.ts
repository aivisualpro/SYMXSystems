import mongoose, { Schema, Document, Model } from "mongoose";

// ── Multi-site: Organization ──────────────────────────────────────────
// The top of the hierarchy: Organization → Site → operational data.
//
// SYMX operates as a SINGLE legal entity across all sites, so there is
// exactly one Organization document. It is modeled explicitly rather than
// assumed for two reasons:
//   1. It gives org-level settings (timezone, name, defaults) a real home
//      instead of scattering them through env vars and singleton collections.
//   2. It makes "org-owned vs site-owned" a structural distinction in the
//      data model rather than a convention people have to remember.
//
// Timezone lives here, NOT on Site: every site is in California, so there is
// one timezone for the whole organization. If a site is ever opened in
// another timezone, add an optional `timezone` override on Site and have
// callers fall back to this value — do not duplicate it onto every site now.

export interface IOrganization extends Document {
  name: string;
  slug: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    // All sites are in California (confirmed). Single org-wide timezone.
    timezone: { type: String, default: "America/Los_Angeles" },
  },
  { timestamps: true, collection: "SYMXOrganizations" }
);

const Organization: Model<IOrganization> =
  mongoose.models.Organization ||
  mongoose.model<IOrganization>("Organization", OrganizationSchema);

export default Organization;
