/**
 * The scoping registry decides whether a page warns the user that it is
 * showing every station. Getting it wrong in the "scoped" direction is the
 * dangerous case: a page claimed as filtered but actually unfiltered turns
 * visible confusion into misplaced trust.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "fs";
import path from "path";
import {
  getScopingState,
  SCOPED_PATH_PREFIXES,
  STATION_AGNOSTIC_PATH_PREFIXES,
} from "@/lib/site-scoping-registry";

describe("getScopingState", () => {
  it("reports Write-Ups as scoped", () => {
    expect(getScopingState("/writeups")).toBe("scoped");
    expect(getScopingState("/writeups/anything")).toBe("scoped");
  });

  it("defaults anything unrecognised to UNSCOPED", () => {
    // Every protected page is now classified, so the banner exists for
    // pages that do not exist yet. Unknown must mean unscoped: a new module
    // should show the warning until someone deliberately clears it.
    expect(getScopingState("/some-future-module")).toBe("unscoped");
  });

  it.each(["/owner", "/owner/sites", "/profile", "/admin"])(
    "reports %s as station-agnostic — no banner needed",
    (path) => {
      expect(getScopingState(path)).toBe("agnostic");
    }
  );

  it("defaults an unknown path to UNSCOPED, not scoped", () => {
    // Fail toward warning. A new module added later should get the banner
    // until someone deliberately declares it scoped — the opposite default
    // would silently mark it trustworthy.
    expect(getScopingState("/some-new-module")).toBe("unscoped");
    expect(getScopingState("/")).toBe("unscoped");
  });

  it("only lists modules that are genuinely scoped", () => {
    // Guard against the registry drifting ahead of reality. Update this
    // list in the same commit that actually scopes a module's API routes,
    // never in advance — a page marked scoped that isn't converts visible
    // confusion into invisible trust.
    expect(SCOPED_PATH_PREFIXES).toEqual([
      "/writeups",
      "/fleet",
      "/dispatching",
      "/scheduling",
      "/scorecard",
      "/dashboard",
      "/hr",
      "/incidents",
      "/insurance",
      "/closing",
      "/load-out",
    ]);
  });

  it("lists UI pathnames, not API paths", () => {
    // The banner keys off the page the user is on. /scheduling is the page;
    // /api/schedules is its API. Listing the API path would leave the banner
    // showing on a page that is genuinely scoped.
    expect(getScopingState("/scheduling")).toBe("scoped");
    expect(getScopingState("/schedules")).toBe("unscoped");
  });

  it("marks the modules scoped in this migration as scoped", () => {
    for (const p of ["/fleet", "/dispatching", "/scheduling", "/scorecard", "/hr"]) {
      expect(getScopingState(p)).toBe("scoped");
      expect(getScopingState(`${p}/something/deep`)).toBe("scoped");
    }
  });

  it("classifies every protected page that actually exists", () => {
    // The registry is a hand-maintained list, and hand-maintained lists
    // drift. This walks the real app directory so adding a module forces a
    // decision rather than silently inheriting "unscoped".
    //
    // Unscoped IS a valid answer — it just has to be a deliberate one, which
    // is why a new directory failing here is the point.
    const dir = path.resolve(__dirname, "../../app/(protected)");
    const pages = readdirSync(dir).filter((e) =>
      statSync(path.join(dir, e)).isDirectory()
    );

    const unclassified = pages.filter((p) => {
      const route = `/${p}`;
      return (
        !SCOPED_PATH_PREFIXES.includes(route) &&
        !STATION_AGNOSTIC_PATH_PREFIXES.includes(route)
      );
    });

    expect(
      unclassified,
      unclassified.length
        ? `These pages exist but are in neither list, so they show the ` +
          `"showing all stations" banner by default:\n` +
          unclassified.map((p) => `  • /${p}`).join("\n") +
          `\n\nAdd each to SCOPED_PATH_PREFIXES once its API routes filter ` +
          `by station, or to STATION_AGNOSTIC_PATH_PREFIXES if the station ` +
          `switcher is irrelevant there.`
        : ""
    ).toEqual([]);
  });
});
