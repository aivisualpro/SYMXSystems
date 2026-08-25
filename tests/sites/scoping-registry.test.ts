/**
 * The scoping registry decides whether a page warns the user that it is
 * showing every station. Getting it wrong in the "scoped" direction is the
 * dangerous case: a page claimed as filtered but actually unfiltered turns
 * visible confusion into misplaced trust.
 */
import { describe, it, expect } from "vitest";
import { getScopingState, SCOPED_PATH_PREFIXES } from "@/lib/site-scoping-registry";

describe("getScopingState", () => {
  it("reports Write-Ups as scoped", () => {
    expect(getScopingState("/writeups")).toBe("scoped");
    expect(getScopingState("/writeups/anything")).toBe("scoped");
  });

  it.each([
    "/hr", "/hr/callouts", "/fleet", "/fleet/vehicles",
    "/dispatching", "/scheduling", "/scorecard", "/incidents", "/dashboard",
  ])("reports %s as UNSCOPED — it still shows every station", (path) => {
    expect(getScopingState(path)).toBe("unscoped");
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
    // never in advance.
    expect(SCOPED_PATH_PREFIXES).toEqual(["/writeups"]);
  });
});
