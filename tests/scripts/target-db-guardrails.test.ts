/**
 * Guardrails around which database a maintenance script writes to.
 *
 * These protect against the single most damaging mistake available during
 * this migration: running a backfill against production while believing it
 * is staging. The rules are worth testing precisely because the failure is
 * silent — a script that connects to the wrong database succeeds loudly and
 * looks fine.
 */
import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error — plain .mjs helper shared with the migration scripts
import { hostFromUri, dbNameFromUri, looksNonProduction, resolveTargetDb } from "../../scripts/lib/target-db.mjs";

const PROD = "mongodb+srv://user:supersecret@symxproduction.e1h4x4o.mongodb.net/symx?retryWrites=true";
const STAGING = "mongodb+srv://user:supersecret@symxproduction.e1h4x4o.mongodb.net/symx-staging?retryWrites=true";

const originalArgv = process.argv;
afterEach(() => { process.argv = originalArgv; });

const withArgs = (...args: string[]) => { process.argv = ["node", "script", ...args]; };

describe("connection string parsing", () => {
  it("extracts the host", () => {
    expect(hostFromUri(PROD)).toBe("symxproduction.e1h4x4o.mongodb.net");
  });

  it("never exposes credentials in the host — these strings get printed to logs", () => {
    expect(hostFromUri(PROD)).not.toContain("supersecret");
    expect(hostFromUri(PROD)).not.toContain("user");
  });

  it("extracts the database name, which is what distinguishes prod from staging", () => {
    expect(dbNameFromUri(PROD)).toBe("symx");
    expect(dbNameFromUri(STAGING)).toBe("symx-staging");
  });
});

describe("production detection", () => {
  it("treats an unmarked database as production", () => {
    expect(looksNonProduction(PROD)).toBe(false);
  });

  it("recognises staging by database name even on the production host", () => {
    // The realistic setup: staging is a separate DATABASE inside the same
    // Atlas cluster, so host alone can't distinguish them.
    expect(looksNonProduction(STAGING)).toBe(true);
  });

  it.each(["staging", "stage", "test", "dev", "sandbox", "preview"])(
    "recognises %s as non-production",
    (hint) => {
      expect(looksNonProduction(`mongodb+srv://u:p@host.net/symx-${hint}`)).toBe(true);
    }
  );

  it("fails safe — an ambiguous name is treated as production, not staging", () => {
    expect(looksNonProduction("mongodb+srv://u:p@host.net/symx-backup-2026")).toBe(false);
  });
});

describe("target resolution", () => {
  it("defaults to staging whenever a staging URI is configured", () => {
    withArgs();
    const r = resolveTargetDb({ MONGODB_URI: PROD, STAGING_MONGODB_URI: STAGING }, { scriptName: "test" });
    expect(r.uri).toBe(STAGING);
    expect(r.isProduction).toBe(false);
  });

  it("REFUSES production unless the acknowledgement flag is present", () => {
    withArgs("--target=production");
    expect(() =>
      resolveTargetDb({ MONGODB_URI: PROD, STAGING_MONGODB_URI: STAGING }, { scriptName: "test" })
    ).toThrow(/production/i);
  });

  it("allows production once explicitly acknowledged", () => {
    withArgs("--target=production", "--i-know-this-is-production");
    const r = resolveTargetDb({ MONGODB_URI: PROD, STAGING_MONGODB_URI: STAGING }, { scriptName: "test" });
    expect(r.uri).toBe(PROD);
    expect(r.isProduction).toBe(true);
  });

  it("refuses a bare production URI even when no staging exists", () => {
    // Someone who hasn't set up staging yet still shouldn't be one command
    // away from mutating production.
    withArgs();
    expect(() => resolveTargetDb({ MONGODB_URI: PROD }, { scriptName: "test" })).toThrow();
  });

  it("honours an explicit --uri override", () => {
    withArgs(`--uri=${STAGING}`);
    const r = resolveTargetDb({ MONGODB_URI: PROD }, { scriptName: "test" });
    expect(r.uri).toBe(STAGING);
  });

  it("still applies the production check to an explicit --uri", () => {
    withArgs(`--uri=${PROD}`);
    expect(() => resolveTargetDb({}, { scriptName: "test" })).toThrow();
  });

  it("errors clearly when --target=staging is asked for but not configured", () => {
    withArgs("--target=staging");
    expect(() => resolveTargetDb({ MONGODB_URI: PROD }, { scriptName: "test" })).toThrow(/STAGING_MONGODB_URI/);
  });
});
