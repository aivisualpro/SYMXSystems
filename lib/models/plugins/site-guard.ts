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
   * The first few non-plumbing frames, kept only for the first sighting.
   * Stack resolution through mongoose + a bundler is genuinely unreliable,
   * so when `origin` comes back "unknown" this is what makes the failure
   * diagnosable instead of just disappointing.
   */
  stackSample?: string[];
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
export function hasSiteScope(filter: any, field: string = "siteId"): boolean {
  if (!filter || typeof filter !== "object") return false;
  if (field in filter) return true;

  // The deliberate "match nothing" filter from siteFilter() when a user has
  // no station. Restrictive, so it counts as scoped.
  if (filter._id && typeof filter._id === "object" && Array.isArray(filter._id.$in) && filter._id.$in.length === 0) {
    return true;
  }

  // $and is conjunctive: every branch must hold, so ONE scoped branch
  // restricts the whole query.
  if (Array.isArray(filter.$and) && filter.$and.some((b: any) => hasSiteScope(b, field))) {
    return true;
  }

  // $or is disjunctive: any branch can match on its own, so a single
  // unscoped branch widens the query straight back out to every station.
  // EVERY branch has to be scoped. This is the shape siteFilter() produces
  // for the migration-window "unassigned records" shim.
  if (
    Array.isArray(filter.$or) &&
    filter.$or.length > 0 &&
    filter.$or.every((b: any) => hasSiteScope(b, field))
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

// Frames belonging to the plumbing rather than to the caller we want.
const NOISE = [
  "site-guard",
  "node_modules",
  "node:internal",
  "/mongoose/",
  "kareem",
  "next/dist",
  "webpack-runtime",
];

/**
 * Best-effort "which file issued this query".
 *
 * Two things make this harder than it looks in a Next.js app:
 *
 *  1. V8 captures only 10 stack frames by default. Mongoose reaches the
 *     pre-hook through Query.exec -> kareem -> hook wrappers, which can
 *     consume the entire budget before any application frame appears —
 *     so the honest-looking answer is "unknown" even though the caller is
 *     right there, a few frames further down.
 *
 *  2. Frames point at bundler paths (webpack-internal:///(rsc)/./app/...,
 *     [project]/app/... under Turbopack, .next/server/...) rather than
 *     source paths, so naive matching on "/app/" misses them.
 */
function callOrigin(boundary: Function): string {
  const prevLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 60;
  const holder: { stack?: string } = {};
  // Cuts every frame above AND INCLUDING `boundary`. The boundary must be
  // the guard's outermost function, not this one: passing callOrigin only
  // strips callOrigin, leaving record() and check() on the stack — which
  // is why the first version reported "record" as the caller of all 17
  // violations. String-matching the filename does not work either, since
  // a bundler rewrites the path.
  Error.captureStackTrace(holder, boundary);
  const stack = holder.stack || "";
  Error.stackTraceLimit = prevLimit;

  const frames = stack.split("\n").slice(1);
  const appFrame =
    frames.find((l) => !NOISE.some((n) => l.includes(n)) && /\/(app|lib|components)\//.test(l)) ||
    frames.find((l) => !NOISE.some((n) => l.includes(n)));

  if (!appFrame) return "unknown";

  return cleanFrame(appFrame);
}

/** The first few meaningful frames, for when callOrigin() gives up. */
function stackSample(): string[] {
  const prevLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 60;
  const stack = new Error().stack || "";
  Error.stackTraceLimit = prevLimit;

  return stack
    .split("\n")
    .slice(1)
    .filter((l) => !l.includes("site-guard"))
    .slice(0, 8)
    .map((l) => cleanFrame(l));
}

function cleanFrame(frame: string): string {
  return frame
    .trim()
    .replace(/^at\s+/, "")
    // Normalise bundler noise down to a path a person can actually open.
    .replace(/webpack-internal:\/{3}\([^)]*\)\/\.?/, "")
    .replace(/\[project\]\//, "")
    .replace(/^.*?\/\.next\/server\//, ".next/server/")
    .replace(/\?\d+/, "")
    .slice(0, 160);
}

/**
 * A stable signature for a filter: its top-level keys, not its values.
 *
 * Values are useless as an identity here — they carry per-call timestamps
 * ({registrationEndDate: {$gt: "2026-08-26T05:08:02Z"}}), so keying on
 * them would make every single call a unique entry and turn the report
 * into an unbounded log. Keys stay constant per call site.
 */
function filterShape(filter: any): string {
  if (!filter || typeof filter !== "object") return "-";
  const keys = Object.keys(filter).sort();
  return keys.length ? keys.join(",") : "{}";
}

function record(modelName: string, operation: string, filter: any, kind: "byId" | "broad", boundary: Function) {
  const origin = callOrigin(boundary);
  // Shape is in the key so two different call sites querying the same
  // model don't collapse into one entry when origin can't be resolved.
  const key = `${modelName}|${operation}|${kind}|${origin}|${filterShape(filter)}`;
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
    // Only captured when the heuristic failed — otherwise it is noise.
    stackSample: origin === "unknown" ? stackSample() : undefined,
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

export function siteGuard(
  schema: Schema,
  options: { modelName: string; field?: "siteId" | "currentSiteId" | "primarySiteId" }
) {
  const { modelName } = options;
  // Transferable models (vehicles, employees) carry their station in a
  // different field, so the guard has to look for the right one or it
  // would flag correctly-scoped queries as unscoped.
  const field = options.field || "siteId";

  function check(this: any, operation: string) {
    const mode = modeFor(modelName);
    if (mode === "off") return;

    // Explicit opt-out for deliberate cross-station reads. Requires a
    // reason so the exception is self-documenting at the call site.
    const orgWideReason = this.getOptions?.()?.orgWide;
    if (orgWideReason) return;

    let filter: any = {};
    try { filter = this.getFilter ? this.getFilter() : this.getQuery?.() || {}; } catch { /* ignore */ }

    if (hasSiteScope(filter, field)) return;

    const kind = isByIdOnly(filter) ? "byId" : "broad";
    const v = record(modelName, operation, filter, kind, check);

    // byId is the fetch-then-check pattern and is usually fine — never
    // throw on it, only report. Throwing would break legitimate code the
    // guard simply can't see the second half of.
    if (mode === "enforce" && kind === "broad") {
      throw new Error(
        `[site-guard] ${modelName}.${operation}() ran without a station filter.\n` +
          `  Filter: ${v.filter}\n` +
          `  From:   ${v.origin}\n\n` +
          `Use siteFilter(scope${field === "siteId" ? "" : `, { field: "${field}" }`}) from lib/scoped-query,\n` +
          `or if this genuinely needs\n` +
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

  // Named so it can be used as the stack boundary, same as check().
  function aggregateHook(this: any) {

  // Aggregations bypass query middleware entirely, so they need their own
  // hook — and they are exactly where cross-station blending happens
  // silently, since a pipeline with no $match reads the whole collection.
    const mode = modeFor(modelName);
    if (mode === "off") return;
    if (this.options?.orgWide) return;

    const pipeline = this.pipeline() || [];
    const firstMatch = pipeline.find((s: any) => s && s.$match);
    if (firstMatch && hasSiteScope(firstMatch.$match, field)) return;

    const v = record(modelName, "aggregate", firstMatch?.$match || {}, "broad", aggregateHook);
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
  }
  schema.pre("aggregate", aggregateHook);

  // ── Bulk writes ───────────────────────────────────────────────────────
  //
  // bulkWrite() and insertMany() do NOT pass through query middleware, so
  // every hook above is blind to them. That is not a footnote: 23 write
  // paths on site-owned models were missing their station filter while the
  // guard and the audit both reported clean, because neither could see the
  // operation at all. A check that cannot observe a whole category of
  // writes reports zero for it forever.
  //
  // The `pre("bulkWrite")` hook exists but does not receive the operation
  // list, so it cannot inspect filters. Wrapping the compiled model is what
  // actually gives access to the arguments.
  function guardBulk(model: any) {
    const mode = () => modeFor(modelName);

    const flag = Symbol.for("symx.siteGuard.bulkWrapped");
    if (model[flag]) return; // hot reload re-registers the model
    model[flag] = true;

    /** Complain about one operation that carries no station. */
    function reportOp(operation: string, filter: any, kind: "broad" | "byId", boundary: Function) {
      const v = record(modelName, operation, filter, kind, boundary);
      if (mode() === "enforce" && kind === "broad") {
        throw new Error(
          `[site-guard] ${modelName}.${operation}() wrote without a station.\n` +
            `  Filter: ${v.filter}\n` +
            `  From:   ${v.origin}\n\n` +
            `Include ${field} in BOTH the filter and the written document — in a\n` +
            `bulk upsert the filter is the identity of the row, so omitting it\n` +
            `lets two stations share one record.`
        );
      }
      if (v.count === 1) {
        console.warn(
          `[site-guard] ${kind === "broad" ? "UNSCOPED" : "by-id"} ${modelName}.${operation}() — ${v.origin}`
        );
      }
    }

    const originalBulkWrite = model.bulkWrite.bind(model);
    function guardedBulkWrite(this: any, ops: any[], ...rest: any[]) {
      if (mode() !== "off" && Array.isArray(ops)) {
        for (const op of ops) {
          if (!op || typeof op !== "object") continue;

          // An insert carries no filter; the document itself must name the
          // station, or the row lands unowned and surfaces on whichever
          // station is treated as the default.
          const insertDoc = op.insertOne?.document;
          if (insertDoc) {
            if (!insertDoc[field]) reportOp("bulkWrite:insertOne", insertDoc, "broad", guardedBulkWrite);
            continue;
          }

          for (const name of ["updateOne", "updateMany", "replaceOne", "deleteOne", "deleteMany"]) {
            const spec = op[name];
            if (!spec) continue;
            const filter = spec.filter || {};
            if (hasSiteScope(filter, field)) continue;
            reportOp(`bulkWrite:${name}`, filter, isByIdOnly(filter) ? "byId" : "broad", guardedBulkWrite);
          }
        }
      }
      return originalBulkWrite(ops, ...rest);
    }
    model.bulkWrite = guardedBulkWrite;

    const originalInsertMany = model.insertMany.bind(model);
    function guardedInsertMany(this: any, docs: any, ...rest: any[]) {
      if (mode() !== "off") {
        const list = Array.isArray(docs) ? docs : [docs];
        // One report per call, not per document — a 5,000-row import would
        // otherwise bury every other message in the log.
        const unowned = list.filter((d: any) => d && !d[field]).length;
        if (unowned > 0) {
          reportOp("insertMany", { unownedDocuments: unowned, of: list.length }, "broad", guardedInsertMany);
        }
      }
      return originalInsertMany(docs, ...rest);
    }
    model.insertMany = guardedInsertMany;
  }

  // Fires when the model is compiled from this schema, which is the only
  // point where the model object exists to be wrapped.
  schema.on("init", guardBulk);
}
