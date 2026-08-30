import mongoose from "mongoose";

// ── Stamping imported records with their station ──────────────────────
//
// Importers build plain objects and hand them to insertMany() or
// bulkWrite(). Both go straight to the MongoDB driver, bypassing Mongoose
// document construction — which means schema defaults do not apply and,
// more importantly, nothing stamps the owning station. Imported rows
// landed with no siteId and then surfaced on the default station's screens
// regardless of who imported them or where they belong.
//
// The right treatment differs by model, and getting it backwards causes
// the opposite bug, so the two cases are separate functions rather than
// one with a flag:
//
//   OWNED   — records belonging to the station that produced them
//             (inspections, repairs, incidents, tickets, interviews).
//             The station is part of the row's identity, so it goes in
//             the upsert filter too: without it, two stations importing
//             the same date collapse onto one row.
//
//   GLOBAL  — records identified by a company-wide natural key
//             (a vehicle's VIN, an employee's transporter ID). These
//             must NOT have the station in the filter — a VIN is unique
//             across the company, and filtering by station would create a
//             duplicate vehicle rather than find the existing one. The
//             station is recorded on first insert only.

type Doc = Record<string, any>;

/** Documents for insertMany() on a site-owned model. */
export function stampDocs(docs: Doc[], siteId: any, field = "siteId"): Doc[] {
  if (!siteId) return docs;
  for (const d of docs) {
    if (d && !d[field]) d[field] = siteId;
  }
  return docs;
}

/**
 * bulkWrite ops for a SITE-OWNED model.
 *
 * Adds the station to the filter (it is part of the row's identity) and to
 * the inserted document. `$setOnInsert` rather than `$set`, because
 * ownership is immutable — re-importing a file must not move a record that
 * already belongs to another station.
 */
export function stampOwnedOps(ops: any[], siteId: any, field = "siteId"): any[] {
  if (!siteId) return ops;
  for (const op of ops) {
    const spec = op?.updateOne || op?.updateMany;
    if (spec) {
      spec.filter = { ...(spec.filter || {}), [field]: siteId };
      if (spec.upsert) {
        spec.update = spec.update || {};
        spec.update.$setOnInsert = { ...(spec.update.$setOnInsert || {}), [field]: siteId };
      }
      continue;
    }
    if (op?.insertOne?.document && !op.insertOne.document[field]) {
      op.insertOne.document[field] = siteId;
    }
  }
  return ops;
}

/**
 * bulkWrite ops for a model keyed by a COMPANY-WIDE natural key.
 *
 * The filter is left alone. Only newly created records get the station, so
 * an import run at one station cannot silently reassign a vehicle or
 * employee that already belongs to another.
 */
export function stampGlobalOps(ops: any[], siteId: any, field: string): any[] {
  if (!siteId) return ops;
  for (const op of ops) {
    const spec = op?.updateOne || op?.updateMany;
    if (spec?.upsert) {
      spec.update = spec.update || {};
      spec.update.$setOnInsert = { ...(spec.update.$setOnInsert || {}), [field]: siteId };
    }
  }
  return ops;
}

/** Normalise whatever the caller passed into an ObjectId, or null. */
export function toSiteId(value: any): mongoose.Types.ObjectId | null {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  const s = String(value);
  return /^[a-f\d]{24}$/i.test(s) ? new mongoose.Types.ObjectId(s) : null;
}
