import { describe, it, expect } from "vitest";
import { readdirSync } from "fs";
import path from "path";
import mongoose from "mongoose";

// ── Coverage: is the guard actually attached to everything? ───────────
//
// The guard was shipped, tested, and reported ZERO violations across six
// unscoped modules. Two of the three models it was silently missing were
// Writeup and VerbalCoaching — added by hand before the plugin existed,
// so they declared siteId directly and never picked up the hooks.
//
// Every existing guard test passed, because they all exercised a purpose
// -built test model that DID have the plugin. The tests proved the guard
// works; nothing proved it was installed. This closes that gap: it walks
// the real model directory and asserts coverage over what actually ships.

const MODELS_DIR = path.resolve(__dirname, "../../lib/models");

/**
 * Models carrying a siteId that must NOT be guarded, with the reason.
 * Anything absent from this list is expected to be guarded — so adding an
 * exemption is a deliberate, reviewable act rather than a silent gap.
 */
const INTENTIONALLY_UNGUARDED: Record<string, string> = {
  UserSiteAssignment:
    "siteId is a pointer to a station, not ownership by one. This is the " +
    "table that resolves which stations a user may reach, so it must be " +
    "queryable by userId before any scope exists — guarding it would break " +
    "the lookup that establishes scope.",
};

function hasGuardHooks(schema: mongoose.Schema): boolean {
  const pres = (schema as any)?.s?.hooks?._pres;
  return (pres?.get?.("find")?.length ?? 0) > 0;
}

describe("site guard coverage over real models", () => {
  const loaded: { name: string; schema: mongoose.Schema }[] = [];

  for (const file of readdirSync(MODELS_DIR).filter((f) => f.endsWith(".ts"))) {
    const mod = require(path.join(MODELS_DIR, file));
    const model = mod?.default;
    if (!model?.schema) continue;
    loaded.push({ name: file.replace(/\.ts$/, ""), schema: model.schema });
  }

  it("finds the model directory", () => {
    // A path typo would make every assertion below vacuously pass — the
    // failure mode this whole file exists to prevent.
    expect(loaded.length).toBeGreaterThan(30);
  });

  it("guards every model that owns data via siteId", () => {
    const missing = loaded
      .filter(({ name, schema }) => {
        if (!schema.path("siteId")) return false;
        if (name in INTENTIONALLY_UNGUARDED) return false;
        return !hasGuardHooks(schema);
      })
      .map((m) => m.name);

    expect(
      missing,
      missing.length
        ? `These models declare siteId but have no guard hooks, so their ` +
          `queries are invisible to the guard:\n` +
          missing.map((m) => `  • ${m}`).join("\n") +
          `\n\nApply siteOwned() (preferred), or siteGuard directly if the ` +
          `model already declares siteId and its own indexes. If it genuinely ` +
          `must not be guarded, add it to INTENTIONALLY_UNGUARDED with a reason.`
        : ""
    ).toEqual([]);
  });

  it("keeps every exemption pointing at a model that still exists", () => {
    // A renamed or deleted model would leave a stale exemption quietly
    // excusing nothing — or worse, excusing a future model that reuses
    // the name for a different purpose.
    const names = new Set(loaded.map((m) => m.name));
    const stale = Object.keys(INTENTIONALLY_UNGUARDED).filter((n) => !names.has(n));
    expect(stale, `Stale guard exemptions: ${stale.join(", ")}`).toEqual([]);
  });

  it("requires a real justification for each exemption", () => {
    for (const [name, reason] of Object.entries(INTENTIONALLY_UNGUARDED)) {
      expect(reason.length, `${name}'s exemption needs a real reason`).toBeGreaterThan(40);
    }
  });

  it("guards the two hand-scoped discipline models specifically", () => {
    // Named explicitly because these are the ones that were missing, and
    // because Write-Ups is the only fully scoped module — the guard's role
    // there is to catch a regression, which is precisely what a general
    // coverage assertion is easiest to accidentally exclude.
    for (const name of ["Writeup", "VerbalCoaching"]) {
      const m = loaded.find((x) => x.name === name);
      expect(m, `${name} not found`).toBeDefined();
      expect(hasGuardHooks(m!.schema), `${name} is not guarded`).toBe(true);
    }
  });
});
