#!/usr/bin/env node
/**
 * Clone the production database into a staging database.
 *
 * Reads from MONGODB_URI, writes to STAGING_MONGODB_URI. Pure driver copy —
 * no mongodump/mongorestore needed (those aren't installed on this machine).
 *
 * Safety properties:
 *   • Refuses to run unless the DESTINATION looks non-production.
 *   • Refuses to run if source and destination resolve to the same host+db.
 *   • Wipes each destination collection before copying, so repeat runs
 *     produce a clean mirror rather than accumulating duplicates.
 *   • Never writes to the source. It is opened read-only in practice —
 *     the only operations issued against it are find().
 *
 * Optionally scrubs PII so staging can be handled less carefully than
 * production (recommended — see --scrub).
 *
 * Usage:
 *   node scripts/staging/clone-to-staging.mjs --dry-run
 *   node scripts/staging/clone-to-staging.mjs
 *   node scripts/staging/clone-to-staging.mjs --scrub          # anonymise PII
 *   node scripts/staging/clone-to-staging.mjs --skip=MessageLog,ScoreCard_*
 */
import { MongoClient } from "mongodb";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, hostFromUri, dbNameFromUri, looksNonProduction, confirm, connectWithDiagnostics } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const env = loadEnv(rootDir);

const DRY_RUN = process.argv.includes("--dry-run");
const SCRUB = process.argv.includes("--scrub");
const BATCH = 500;

const skipArg = process.argv.find((a) => a.startsWith("--skip="));
const skipPatterns = skipArg ? skipArg.split("=")[1].split(",").map((s) => s.trim()) : [];
const shouldSkip = (name) =>
  skipPatterns.some((p) =>
    p.endsWith("*") ? name.startsWith(p.slice(0, -1)) : name === p
  );

// ── PII scrubbing ─────────────────────────────────────────────────────
// Staging holds real HR records otherwise — write-ups, incidents, wage
// rates, phone numbers. Scrubbing lets the staging environment be treated
// as lower-sensitivity. Structure and volume are preserved so the data
// still exercises the same code paths.
// Collection names must match EXACTLY (they are case-sensitive in MongoDB,
// and this codebase uses "SYMX" upper-case in collection names while the
// Mongoose model is "SymxEmployee"). A mismatched key here fails silently
// and leaves real PII in staging, so the run aborts if a rule matches
// nothing — see the guard in main().
export const STAGING_PASSWORD = "stagingpassword";

// Generated at runtime, NOT hard-coded. An earlier version pasted a
// literal hash that was structurally valid (60 chars, correct $2b$10$
// prefix) but fabricated — so it matched no password at all and every
// staging login failed with a misleading "Authentication failed".
// Deriving it here means it is correct by construction.
const STAGING_PASSWORD_HASH = SCRUB ? bcrypt.hashSync(STAGING_PASSWORD, 10) : "";

// Captured during the run so the summary can print a real, working login.
let sampleScrubbedEmail = null;

const SCRUB_RULES = {
  SYMXUsers: (d) => {
    const email = d.email ? `user${String(d._id).slice(-6)}@staging.local` : d.email;
    if (!sampleScrubbedEmail && email) sampleScrubbedEmail = email;
    return {
      ...d,
      email,
      // Everyone shares one known password so any account is testable.
      password: STAGING_PASSWORD_HASH,
      phone: d.phone ? "555-0100" : d.phone,
    };
  },
  SYMXEmployees: (d) => ({
    ...d,
    email: d.email ? `emp${String(d._id).slice(-6)}@staging.local` : d.email,
    phoneNumber: d.phoneNumber ? "555-0100" : d.phoneNumber,
    streetAddress: d.streetAddress ? "1 Staging Way" : d.streetAddress,
    gasCardPin: d.gasCardPin ? "0000" : d.gasCardPin,
    dob: d.dob ? new Date("1990-01-01") : d.dob,
  }),
};

async function main() {
  const sourceUri = env.MONGODB_URI;
  const destUri = env.STAGING_MONGODB_URI;

  if (!sourceUri) throw new Error("MONGODB_URI is not set in .env");
  if (!destUri) {
    throw new Error(
      "STAGING_MONGODB_URI is not set in .env.\n\n" +
        "Add a staging connection string first — see STAGING_SETUP.md."
    );
  }

  const srcHost = hostFromUri(sourceUri);
  const dstHost = hostFromUri(destUri);
  const srcDb = dbNameFromUri(sourceUri);
  const dstDb = dbNameFromUri(destUri);

  console.log("─".repeat(64));
  console.log(`  FROM (read-only):  ${srcHost} / ${srcDb || "(default)"}`);
  console.log(`  TO   (overwrite):  ${dstHost} / ${dstDb || "(default)"}`);
  console.log(`  Scrub PII:         ${SCRUB ? "yes" : "NO — staging will hold real HR data"}`);
  console.log("─".repeat(64));
  console.log("");

  // ── Guardrails ──
  if (!looksNonProduction(destUri)) {
    throw new Error(
      `DESTINATION does not look like staging (${dstHost}/${dstDb}).\n` +
        `Refusing to overwrite it. The destination host or database name must contain\n` +
        `one of: staging, stage, test, dev, sandbox, preview.\n\nNothing has been changed.`
    );
  }
  if (srcHost === dstHost && (srcDb || "") === (dstDb || "")) {
    throw new Error("Source and destination are the same database. Refusing to run.");
  }

  if (!DRY_RUN) {
    const ok = await confirm(`This will ERASE and overwrite everything in ${dstHost}/${dstDb}. Continue?`);
    if (!ok) {
      console.log("Aborted — nothing changed.");
      process.exit(0);
    }
  }

  const srcClient = await connectWithDiagnostics(MongoClient, sourceUri);
  const dstClient = await connectWithDiagnostics(MongoClient, destUri);
  const src = srcClient.db();
  const dst = dstClient.db();

  const collections = (await src.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith("system."))
    .sort();

  console.log(`Found ${collections.length} collections.\n`);

  // A scrub rule whose collection name is misspelled matches nothing and
  // silently copies real PII into staging. Fail loudly instead — this is a
  // privacy control, so "quietly did nothing" is the worst outcome.
  if (SCRUB) {
    // Verify the generated hash actually validates before writing 250+ user
    // records with it. Without this, a bad hash produces a clone that looks
    // perfect and fails only at the login screen, with an error message that
    // points nowhere near the cause.
    if (!bcrypt.compareSync(STAGING_PASSWORD, STAGING_PASSWORD_HASH)) {
      throw new Error(
        "Generated staging password hash failed its own verification. " +
          "Refusing to continue — every scrubbed account would be unable to log in."
      );
    }

    const unmatched = Object.keys(SCRUB_RULES).filter((name) => !collections.includes(name));
    if (unmatched.length > 0) {
      throw new Error(
        `--scrub was requested, but these scrub rules match no collection in the source database:\n` +
          unmatched.map((u) => `   • ${u}`).join("\n") +
          `\n\nCollection names are case-sensitive. Available:\n` +
          collections.map((c) => `   ${c}`).join("\n") +
          `\n\nRefusing to continue — fix SCRUB_RULES so PII is actually anonymised.`
      );
    }
  }

  let totalDocs = 0;
  let copiedCollections = 0;
  const skippedList = [];

  for (const name of collections) {
    if (shouldSkip(name)) {
      skippedList.push(name);
      continue;
    }

    const count = await src.collection(name).countDocuments();
    const scrubber = SCRUB ? SCRUB_RULES[name] : null;
    const tag = scrubber ? " [scrubbed]" : "";

    if (DRY_RUN) {
      console.log(`  ${name.padEnd(38)} ${String(count).padStart(7)} docs${tag}`);
      totalDocs += count;
      copiedCollections++;
      continue;
    }

    // Clean slate so repeat runs mirror rather than accumulate.
    await dst.collection(name).deleteMany({});

    let buffer = [];
    let written = 0;
    const cursor = src.collection(name).find({});
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      buffer.push(scrubber ? scrubber(doc) : doc);
      if (buffer.length >= BATCH) {
        await dst.collection(name).insertMany(buffer, { ordered: false });
        written += buffer.length;
        buffer = [];
      }
    }
    if (buffer.length > 0) {
      await dst.collection(name).insertMany(buffer, { ordered: false });
      written += buffer.length;
    }

    console.log(`  ${name.padEnd(38)} ${String(written).padStart(7)} docs${tag}`);
    totalDocs += written;
    copiedCollections++;
  }

  console.log("");
  if (skippedList.length > 0) {
    console.log(`Skipped ${skippedList.length}: ${skippedList.join(", ")}\n`);
  }

  if (!DRY_RUN) {
    // Verify counts match, so a silent partial copy can't pass unnoticed.
    console.log("Verifying…");
    const mismatches = [];
    for (const name of collections) {
      if (shouldSkip(name)) continue;
      const [s, d] = await Promise.all([
        src.collection(name).countDocuments(),
        dst.collection(name).countDocuments(),
      ]);
      if (s !== d) mismatches.push(`${name}: source ${s} vs staging ${d}`);
    }
    if (mismatches.length > 0) {
      console.log(`\n⚠ ${mismatches.length} collection(s) do not match:`);
      mismatches.forEach((m) => console.log(`   ${m}`));
      process.exitCode = 1;
    } else {
      console.log(`✓ All ${copiedCollections} collections match.`);
    }
  }

  console.log(`\n${DRY_RUN ? "Would copy" : "Copied"} ${totalDocs} documents across ${copiedCollections} collections.`);
  if (DRY_RUN) console.log("\n--dry-run set — nothing was written.");

  if (SCRUB && !DRY_RUN) {
    console.log("\n── Staging logins ──────────────────────────────────────");
    console.log("  Every user account now shares one password:");
    console.log(`    password: ${STAGING_PASSWORD}`);
    console.log("  Emails were anonymised to user<id>@staging.local, e.g.:");
    console.log(`    ${sampleScrubbedEmail || "user<id>@staging.local"}`);
    console.log("");
    console.log("  List them all with:");
    console.log("    node scripts/staging/list-staging-logins.mjs");
    console.log("");
    console.log("  Your SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD from .env");
    console.log("  also still work — that login bypasses the database.");
    console.log("────────────────────────────────────────────────────────");
  }

  if (!SCRUB && !DRY_RUN) {
    console.log(
      "\n⚠ PII was NOT scrubbed. Staging now holds real employee data —\n" +
        "  treat it with production-level care, or re-run with --scrub."
    );
  }

  await srcClient.close();
  await dstClient.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
