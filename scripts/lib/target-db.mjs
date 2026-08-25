/**
 * Shared target-database resolution for every maintenance/migration script.
 *
 * The single most dangerous mistake in this whole migration is running a
 * backfill against production when you meant staging. This module makes the
 * target explicit and loud, and makes hitting production require a
 * deliberate extra flag.
 *
 * Resolution order (first match wins):
 *   1. --uri=mongodb+srv://...        explicit, highest precedence
 *   2. --target=staging               → STAGING_MONGODB_URI from .env
 *   3. --target=production            → MONGODB_URI from .env
 *   4. STAGING_MONGODB_URI if set     → safe default when one exists
 *   5. MONGODB_URI                    → requires --i-know-this-is-production
 *
 * That ordering means: once you have a staging URI configured, scripts hit
 * STAGING by default. Production is never the accidental target.
 */
import fs from "fs";
import path from "path";
import readline from "readline";

export function loadEnv(rootDir) {
  const envPath = path.join(rootDir, ".env");
  let content = "";
  try {
    content = fs.readFileSync(envPath, "utf-8");
  } catch {
    throw new Error(`Couldn't read ${envPath} — run this from the project root.`);
  }
  const env = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=["']?(.*?)["']?\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

/** Pulls the database name out of a connection string, if present. */
export function dbNameFromUri(uri) {
  try {
    // mongodb+srv://user:pass@host/dbname?opts  → "dbname"
    const afterHost = uri.split("://")[1]?.split("/").slice(1).join("/") || "";
    const name = afterHost.split("?")[0];
    return name || null;
  } catch {
    return null;
  }
}

/** Host portion only — never logs credentials. */
export function hostFromUri(uri) {
  try {
    const afterScheme = uri.split("://")[1] || "";
    const hostPart = afterScheme.includes("@") ? afterScheme.split("@")[1] : afterScheme;
    return hostPart.split("/")[0].split("?")[0];
  } catch {
    return "<unparseable>";
  }
}

const SAFE_HINTS = ["staging", "stage", "test", "dev", "sandbox", "preview"];

/** Heuristic: does this look like a non-production target? */
export function looksNonProduction(uri) {
  const haystack = `${hostFromUri(uri)} ${dbNameFromUri(uri) || ""}`.toLowerCase();
  return SAFE_HINTS.some((h) => haystack.includes(h));
}

function argValue(flag) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

/**
 * Resolves and validates the target. Returns { uri, label, isProduction }.
 * Throws (does not silently fall back) when the intent is ambiguous.
 */
export function resolveTargetDb(env, { scriptName = "script" } = {}) {
  const explicitUri = argValue("--uri");
  const target = argValue("--target");

  let uri;
  let label;

  if (explicitUri) {
    uri = explicitUri;
    label = "explicit --uri";
  } else if (target === "staging") {
    uri = env.STAGING_MONGODB_URI;
    label = "STAGING_MONGODB_URI";
    if (!uri) throw new Error("--target=staging but STAGING_MONGODB_URI is not set in .env");
  } else if (target === "production" || target === "prod") {
    uri = env.MONGODB_URI;
    label = "MONGODB_URI (production)";
    if (!uri) throw new Error("--target=production but MONGODB_URI is not set in .env");
  } else if (env.STAGING_MONGODB_URI) {
    // A staging URI exists and no target was named — default to the safe one.
    uri = env.STAGING_MONGODB_URI;
    label = "STAGING_MONGODB_URI (default — pass --target=production to override)";
  } else {
    uri = env.MONGODB_URI;
    label = "MONGODB_URI";
    if (!uri) throw new Error("No MONGODB_URI or STAGING_MONGODB_URI found in .env");
  }

  const isProduction = !looksNonProduction(uri);
  const host = hostFromUri(uri);
  const dbName = dbNameFromUri(uri) || "(default database in connection string)";

  console.log("─".repeat(64));
  console.log(`  Script:   ${scriptName}`);
  console.log(`  Source:   ${label}`);
  console.log(`  Host:     ${host}`);
  console.log(`  Database: ${dbName}`);
  console.log(`  Assessed: ${isProduction ? "⚠  PRODUCTION" : "✓ non-production"}`);
  console.log("─".repeat(64));
  console.log("");

  if (isProduction && !process.argv.includes("--i-know-this-is-production")) {
    throw new Error(
      "This target does not look like staging, so it is being treated as PRODUCTION.\n\n" +
        "If that is intentional, re-run with:  --i-know-this-is-production\n" +
        "If it is not, set STAGING_MONGODB_URI in .env or pass --uri=<staging uri>.\n\n" +
        "Nothing has been changed."
    );
  }

  return { uri, label, isProduction, host, dbName };
}

/** Interactive y/N confirmation. Auto-yes with --yes for scripted runs. */
export async function confirm(question) {
  if (process.argv.includes("--yes") || process.argv.includes("-y")) {
    console.log(`${question} → auto-confirmed (--yes)`);
    return true;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) => rl.question(`${question} [y/N] `, res));
  rl.close();
  return answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes";
}
