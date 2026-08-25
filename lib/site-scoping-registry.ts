// ── Which parts of the app actually filter by station ─────────────────
//
// The migration scopes one module at a time, so for a while the app is in
// a half-migrated state: some pages respect the station switcher and some
// silently show everything. That is genuinely confusing — you select DXC8,
// see DFO2's records, and reasonably conclude the switcher is broken.
//
// This registry is the single source of truth for which is which. Pages
// not listed here get a banner saying so. As each module is scoped, move
// its prefix into SCOPED_PATH_PREFIXES and the banner disappears on its
// own — the list doubles as the migration's progress tracker.
//
// Keep this honest. A page listed as scoped that isn't is worse than no
// registry at all, because it converts visible confusion into invisible
// trust.

/**
 * Path prefixes where server-side station scoping is ENFORCED — the API
 * routes behind them filter by siteId, and switching stations changes the
 * data. Verified, not aspirational.
 */
export const SCOPED_PATH_PREFIXES: string[] = [
  "/writeups", // Write-Ups + Verbal Coachings — app/api/writeups, app/api/verbal-coachings
];

/**
 * Path prefixes where the station switcher is irrelevant by design, so no
 * banner is needed. These are organization-level or personal screens, not
 * station-owned data.
 */
export const STATION_AGNOSTIC_PATH_PREFIXES: string[] = [
  "/owner",    // stations, users, roles — organization-level administration
  "/profile",  // the signed-in user's own account
  "/admin",    // app configuration
];

export type ScopingState = "scoped" | "unscoped" | "agnostic";

export function getScopingState(pathname: string): ScopingState {
  if (STATION_AGNOSTIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return "agnostic";
  if (SCOPED_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return "scoped";
  return "unscoped";
}
