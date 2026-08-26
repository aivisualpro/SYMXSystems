import { Schema } from "mongoose";
import { siteGuard } from "./site-guard";

// ── siteOwned plugin ──────────────────────────────────────────────────
// Marks a collection as belonging to exactly one station, and adds the
// field plus the indexes that scoping needs.
//
// Applied as one line per model rather than hand-editing ~30 schemas:
// less to get wrong, and the list of models carrying this plugin IS the
// definition of "site-owned data" — greppable in one place.
//
// Ownership is IMMUTABLE. If an employee or vehicle later transfers, the
// records they generated stay with the station where the work actually
// happened. Nothing here rewrites siteId on transfer, deliberately.
//
// siteId is optional during the migration window and becomes required at
// the Phase 5 contract step, once the backfill has stamped every
// existing document.

export interface SiteOwnedOptions {
  /**
   * The field this collection is normally sorted/filtered by (a date, a
   * week string). Used to build a leading-siteId compound index on the hot
   * read path — without it, scoping converts a full-collection scan into a
   * filtered full-collection scan.
   */
  sortField?: string;
  /**
   * Extra leading-siteId compound indexes for other common query shapes,
   * e.g. ["status", "createdAt"].
   */
  extraIndexes?: string[][];
  /**
   * Model name for guard reporting. Without it the guard still works but
   * violations are harder to attribute, so every caller should pass it.
   */
  modelName?: string;
}

export function siteOwned(schema: Schema, options: SiteOwnedOptions = {}) {
  schema.add({
    siteId: {
      type: Schema.Types.ObjectId,
      ref: "Site",
      index: true,
    },
  } as any);

  if (options.sortField) {
    schema.index({ siteId: 1, [options.sortField]: -1 } as any);
  }

  for (const fields of options.extraIndexes || []) {
    const spec: Record<string, 1 | -1> = { siteId: 1 };
    for (const f of fields) spec[f] = 1;
    schema.index(spec as any);
  }

  // Every site-owned model is guarded automatically. Attaching this here
  // rather than per-model means a model can't gain a siteId field while
  // quietly skipping the check that the field is actually being used.
  schema.plugin(siteGuard, { modelName: options.modelName || "UnknownModel" });
}

/**
 * Marks a collection as ORG-owned but assigned to a station, and
 * transferable between them — employees and vehicles.
 *
 * Deliberately a different field name (`primarySiteId` / `currentSiteId`)
 * from site-owned records' `siteId`. The distinction is the point: a
 * write-up's siteId is history and never changes, whereas an employee's
 * primary station is a mutable fact about where they work today. Sharing
 * one field name would invite code that treats them the same and quietly
 * rewrites history on transfer.
 */
export interface SiteAssignedOptions {
  field: "primarySiteId" | "currentSiteId";
  modelName?: string;
}

// Takes an options OBJECT rather than positional arguments because
// mongoose invokes plugins as fn(schema, options) — it forwards exactly
// one options value, so a third parameter can never be passed.
export function siteAssigned(schema: Schema, options: SiteAssignedOptions) {
  const fieldName = options.field;
  schema.add({
    [fieldName]: {
      type: Schema.Types.ObjectId,
      ref: "Site",
      index: true,
    },
  } as any);

  // Guarded too. An unscoped Vehicle.find() lists every station's fleet
  // and an unscoped employee query every station's roster — the fact that
  // these records TRANSFER rather than being owned forever changes which
  // field holds the station, not whether the query needs scoping.
  schema.plugin(siteGuard, {
    modelName: options.modelName || "UnknownAssignedModel",
    field: fieldName,
  });
}
