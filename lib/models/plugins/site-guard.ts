import { Schema } from "mongoose";

// ── Site query guard ──────────────────────────────────────────────────
// Intercepts every query on a site-owned model and reports (or refuses)
// any that isn't restricted to a station.
//
// Why this exists: scoping ~130 routes by hand means being right ~130
// times. In this migration alone, three separate scoping mistakes passed
// code review AND a green test suite — a DELETE with no ownership check,
// a filter that leaked unassigned records to every station, and a cache
// invalidation that did nothing. Each one read as though it worked.
//
// This converts "did I remember?" into "the code won't let me forget".
//
// ── Modes ──
//   off      — no checking (production default until a module is ready)
//   log      — records violations, allows the query. Ships first, so the
//              log enumerates every unscoped path before anything breaks.
//   enforce  — throws. Flipped on per-module once its log is clean.
//
// Set globally with SITE_GUARD_MODE, or per-module via setModuleGuardMode().

export type GuardMode = "off" | "log" | "enforce";

export interface GuardViolation {
  model: string;
  operation: string;
  /** Serialised filter, for identifying the call site. */
  filter: string;
  /** Where it came from, best-effort from the stack. */
  origin: string;
  /**
   * byId  — filtered on _id alone. Common and often FINE (fetch-then-check),
   *         but the guard can't see whether the caller checks ownership
   *         afterwards, so these are reported separately for human review
   *         rather than passed or failed.
   * broad — no station and no _id. Almost certainly a leak.
   */
  kind: "byId" | "broad";
  count: number;
}

// ── State lives on globalThis, not in module scope ────────────────────
// Next.js bundles each route handler separately, so a module-level Map
// gives every route its OWN copy: the fleet route records violations into
// one instance while /api/admin/site-guard reads an empty one, and the
// guard reports "0 violations" for an app full of them.
//
// This is the same reason lib/db.ts caches its connection on
// global.mongoose. First version of this file ignored that precedent and
// reported a clean bill of health across six unscoped modules.
interface GuardState {
  violations: Map<string, GuardViolation>;
  moduleModes: Map<string, GuardMode>;
}
const g = globalThis as any;
if (!g.__symxSiteGuard) {
  g.__symxSiteGuard = { violations: new Map(), moduleModes: new Map() } as GuardState;
}
const state: GuardState = g.__symxSiteGuard;
const violations = state.violations;

function globalMode(): GuardMode {
  const m = process.env.SITE_GUARD_MODE as GuardMode | undefined;
  if (m === "off" || m === "log" || m === "enforce") return m;
  // Default to log in development so violations surface while working,
  // and off in production until a module is deliberately switched on —
  // a guard that starts throwing in production without anyone choosing
  // that would be its own outage.
  return process.env.NODE_ENV === "production" ? "off" : "log";
}

/** Override the mode for one model, e.g. after its routes are scoped. */
export function setModuleGuardMode(modelName: string, mode: GuardMode) {
  state.moduleModes.set(modelName, mode);
}

function modeFor(modelName: string): GuardMode {
  return state.moduleModes.get(modelName) ?? globalMode();
}

/**
 * Does this filter restrict to a station?
 *
 * Handles the shapes siteFilter() actually produces, including the
 * `$or: [{siteId…}, {siteId: {$exists:false}}, …]` form used during the
 * migration window.
 */
export function hasSiteScope(filter: any): boolean {
  if (!filter || typeof filter !== "object") return false;
  if ("siteId" in filter) return true;

  // The deliberate "match nothing" filter from siteFilter() when a user has
  // no station. Restrictive, so it counts as scoped.
  if (filter._id && typeof filter._id === "object" && Array.isArray(filter._id.$in) && filter._id.$in.length === 0) {
    return true;
  }

  // $and is conjunctive: every branch must hold, so ONE scoped branch
  // restricts the whole query.
  if (Array.isArray(filter.$and) && filter.$and.some((b: any) => hasSiteScope(b))) {
    return true;
  }

  // $or is disjunctive: any branch can match on its own, so a single
  // unscoped branch widens the query straight back out to every station.
  // EVERY branch has to be scoped. This is the shape siteFilter() produces
  // for the migration-window "unassigned records" shim.
  if (
    Array.isArray(filter.$or) &&
    filter.$or.length > 0 &&
    filter.$or.every((b: any) => hasSiteScope(b))
  ) {
    return true;
  }

  // $nor is deliberately absent. A siteId inside $nor EXCLUDES that
  // station rather than restricting to it — the opposite of scoping.
  // Treating it as scoped would turn "everything except DFO2" into a
  // query the guard waves through.

  return false;
}

function isByIdOnly(filter: any): boolean {
  if (!filter || typeof filter !== "object") return false;
  const keys = Object.keys(filter);
  return keys.length === 1 && keys[0] === "_id";
}

function callOrigin(): string {
  const stack = new Error().stack || "";
  const line = stack
    .split("\n")
    .find(
      (l) =>
        (l.includes("/app/") || l.includes("/lib/")) &&
        !l.includes("site-guard") &&
        !l.includes("node_modules")
    );
  return (line || "unknown").trim().replace(/^at\s+/, "").slice(0, 160);
}

function record(modelName: string, operation: string, filter: any, kind: "byId" | "broad") {
  const origin = callOrigin();
  const key = `${modelName}|${operation}|${kind}|${origin}`;
  const existing = violations.get(key);
  if (existing) {
    existing.count++;
    return existing;
  }
  const v: GuardViolation = {
    model: modelName,
    operation,
    filter: (() => { try { return JSON.stringify(filter); } catch { return "<unserialisable>"; } })().slice(0, 300),
    origin,
    kind,
    count: 1,
  };
  violations.set(key, v);
  return v;
}

/** Everything seen so far, worst first. */
export function getGuardViolations(): GuardViolation[] {
  return [...violations.values()].sort(
    (a, b) => (a.kind === b.kind ? b.count - a.count : a.kind === "broad" ? -1 : 1)
  );
}

export function clearGuardViolations() {
  violations.clear();
}

const READ_OPS = [
  "find", "findOne", "findOneAndUpdate", "findOneAndDelete", "findOneAndReplace",
  "count", "countDocuments", "distinct",
] as const;

const WRITE_OPS = ["updateOne", "updateMany", "deleteOne", "deleteMany", "replaceOne"] as const;

export function siteGuard(schema: Schema, options: { modelName: string }) {
  const { modelName } = options;

  const check = function (this: any, operation: string) {
    const mode = modeFor(modelName);
    if (mode === "off") return;

    // Explicit opt-out for deliberate cross-station reads. Requires a
    // reason so the exception is self-documenting at the call site.
    const orgWideReason = this.getOptions?.()?.orgWide;
    if (orgWideReason) return;

    let filter: any = {};
    try { filter = this.getFilter ? this.getFilter() : this.getQuery?.() || {}; } catch { /* ignore */ }

    if (hasSiteScope(filter)) return;

    const kind = isByIdOnly(filter) ? "byId" : "broad";
    const v = record(modelName, operation, filter, kind);

    // byId is the fetch-then-check pattern and is usually fine — never
    // throw on it, only report. Throwing would break legitimate code the
    // guard simply can't see the second half of.
    if (mode === "enforce" && kind === "broad") {
      throw new Error(
        `[site-guard] ${modelName}.${operation}() ran without a station filter.\n` +
          `  Filter: ${v.filter}\n` +
          `  From:   ${v.origin}\n\n` +
          `Use siteFilter(scope) from lib/scoped-query, or if this genuinely needs\n` +
          `to span stations, declare it:  .setOptions({ orgWide: "why" })`
      );
    }

    if (v.count === 1) {
      console.warn(
        `[site-guard] ${kind === "broad" ? "UNSCOPED" : "by-id"} ${modelName}.${operation}() — ${v.origin}`
      );
    }
  };

  for (const op of [...READ_OPS, ...WRITE_OPS]) {
    schema.pre(op as any, function (this: any) { check.call(this, op); });
  }

  // Aggregations bypass query middleware entirely, so they need their own
  // hook — and they are exactly where cross-station blending happens
  // silently, since a pipeline with no $match reads the whole collection.
  schema.pre("aggregate", function (this: any) {
    const mode = modeFor(modelName);
    if (mode === "off") return;
    if (this.options?.orgWide) return;

    const pipeline = this.pipeline() || [];
    const firstMatch = pipeline.find((s: any) => s && s.$match);
    if (firstMatch && hasSiteScope(firstMatch.$match)) return;

    const v = record(modelName, "aggregate", firstMatch?.$match || {}, "broad");
    if (mode === "enforce") {
      throw new Error(
        `[site-guard] ${modelName}.aggregate() has no station filter in its first $match.\n` +
          `  From: ${v.origin}\n\n` +
          `Start the pipeline with { $match: siteFilter(scope) }, or declare it org-wide.`
      );
    }
    if (v.count === 1) {
      console.warn(`[site-guard] UNSCOPED ${modelName}.aggregate() — ${v.origin}`);
    }
  });
}
