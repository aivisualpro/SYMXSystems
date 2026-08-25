/**
 * Site scoping primitives.
 *
 * These functions decide whether one station's HR records reach another
 * station's staff. The tests below are deliberately paranoid about the
 * FAIL-OPEN cases — a scoping bug that shows too much is silent, ships
 * cleanly, and is only discovered by whoever it harms.
 */
import { describe, it, expect } from "vitest";
import { siteFilter, canAccessRecord, resolveWriteSiteId, type RequestScope } from "@/lib/scoped-query";

const SITE_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SITE_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const SITE_C = "cccccccccccccccccccccccc";

const scope = (over: Partial<RequestScope> = {}): RequestScope => ({
  userId: "user1",
  isOrgAdmin: false,
  isReadOnly: false,
  allowedSiteIds: [SITE_A],
  activeSiteIds: [SITE_A],
  mode: "single",
  isEmpty: false,
  ...over,
});

describe("siteFilter", () => {
  it("restricts to the active station", () => {
    expect(siteFilter(scope())).toEqual({ siteId: { $in: [SITE_A] } });
  });

  it("includes every selected station in multi mode", () => {
    const f = siteFilter(scope({ activeSiteIds: [SITE_A, SITE_B], mode: "multi" }));
    expect(f).toEqual({ siteId: { $in: [SITE_A, SITE_B] } });
    expect(f.siteId.$in).not.toContain(SITE_C);
  });

  it("MATCHES NOTHING when the user has no station — never an empty filter", () => {
    // The single most dangerous possible bug in this file. An empty filter
    // object ({}) matches EVERY document, so a user with no station would
    // silently see every record at every station.
    const f = siteFilter(scope({ activeSiteIds: [], allowedSiteIds: [], isEmpty: true }));
    expect(f).toEqual({ _id: { $in: [] } });
    expect(Object.keys(f).length).toBeGreaterThan(0);
    expect(f).not.toEqual({});
  });

  it("does not return an unfiltered query for an org admin", () => {
    // Org-wide means "every station I'm entitled to", expressed explicitly.
    // It must never degrade into "no filter at all", which would also pick
    // up records belonging to no station.
    const f = siteFilter(scope({ isOrgAdmin: true, mode: "org", allowedSiteIds: [SITE_A, SITE_B, SITE_C], activeSiteIds: [SITE_A, SITE_B, SITE_C] }));
    expect(f).toEqual({ siteId: { $in: [SITE_A, SITE_B, SITE_C] } });
  });

  describe("includeUnassigned (migration window only)", () => {
    it("also matches records with no siteId", () => {
      const f = siteFilter(scope(), { includeUnassigned: true });
      expect(f.$or).toHaveLength(3);
      expect(f.$or[0]).toEqual({ siteId: { $in: [SITE_A] } });
    });

    it("still matches nothing when the user has no station", () => {
      // The escape hatch must not become a bypass: no station means no
      // records, even during the migration.
      const f = siteFilter(scope({ activeSiteIds: [], isEmpty: true }), { includeUnassigned: true });
      expect(f).toEqual({ _id: { $in: [] } });
    });
  });
});

describe("canAccessRecord", () => {
  it("allows a record at the user's own station", () => {
    expect(canAccessRecord(scope(), { siteId: SITE_A })).toBe(true);
  });

  it("REFUSES a record at another station", () => {
    expect(canAccessRecord(scope(), { siteId: SITE_B })).toBe(false);
    expect(canAccessRecord(scope(), { siteId: SITE_C })).toBe(false);
  });

  it("checks allowed stations, not merely the selected one", () => {
    // Following a link to a record at a station you can reach but haven't
    // selected should work — otherwise deep links break constantly and
    // people learn to distrust 404s.
    const s = scope({ allowedSiteIds: [SITE_A, SITE_B], activeSiteIds: [SITE_A] });
    expect(canAccessRecord(s, { siteId: SITE_B })).toBe(true);
  });

  it("refuses everything when the user has no station", () => {
    const s = scope({ allowedSiteIds: [], activeSiteIds: [], isEmpty: true });
    expect(canAccessRecord(s, { siteId: SITE_A })).toBe(false);
    expect(canAccessRecord(s, {})).toBe(false);
  });

  it("refuses a null/undefined record", () => {
    expect(canAccessRecord(scope(), null)).toBe(false);
    expect(canAccessRecord(scope(), undefined)).toBe(false);
  });

  it("allows an unassigned record during the migration window", () => {
    // Documented, deliberate, and temporary — tightened at Phase 5.
    expect(canAccessRecord(scope(), { siteId: null })).toBe(true);
    expect(canAccessRecord(scope(), {})).toBe(true);
  });

  it("compares as strings, so ObjectId vs string can't create a false negative", () => {
    const objectIdLike = { toString: () => SITE_A };
    expect(canAccessRecord(scope(), { siteId: objectIdLike })).toBe(true);
  });
});

describe("resolveWriteSiteId", () => {
  it("uses the active station when exactly one is selected", () => {
    expect(resolveWriteSiteId(scope())).toBe(SITE_A);
  });

  it("REFUSES a station the user cannot reach, even if explicitly requested", () => {
    // The core write-path defence: a crafted request body must not be able
    // to plant a record at another station.
    expect(resolveWriteSiteId(scope(), SITE_B)).toBeNull();
  });

  it("accepts an explicit station the user CAN reach", () => {
    const s = scope({ allowedSiteIds: [SITE_A, SITE_B], activeSiteIds: [SITE_A] });
    expect(resolveWriteSiteId(s, SITE_B)).toBe(SITE_B);
  });

  it("returns null when viewing several stations — caller must prompt", () => {
    // Guessing here would file a disciplinary record against whichever
    // station happened to sort first. Refusing is the safe default.
    const s = scope({ activeSiteIds: [SITE_A, SITE_B], mode: "multi" });
    expect(resolveWriteSiteId(s)).toBeNull();
  });

  it("returns null in org-wide mode rather than picking arbitrarily", () => {
    const s = scope({
      isOrgAdmin: true, mode: "org",
      allowedSiteIds: [SITE_A, SITE_B, SITE_C],
      activeSiteIds: [SITE_A, SITE_B, SITE_C],
    });
    expect(resolveWriteSiteId(s)).toBeNull();
  });

  it("returns null when the user has no station", () => {
    expect(resolveWriteSiteId(scope({ activeSiteIds: [], isEmpty: true }))).toBeNull();
  });

  it("does not treat an empty-string request as valid", () => {
    expect(resolveWriteSiteId(scope(), "")).toBe(SITE_A); // falls through to active
    expect(resolveWriteSiteId(scope({ activeSiteIds: [], isEmpty: true }), "")).toBeNull();
  });
});
