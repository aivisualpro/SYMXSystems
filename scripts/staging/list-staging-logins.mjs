#!/usr/bin/env node
/**
 * Lists the usable logins in the staging database.
 *
 * After a --scrub clone, emails are anonymised, so there's no way to guess
 * which account is which. This maps the scrubbed email back to the user's
 * name and role so you can log in as a specific persona (a dispatcher, a
 * manager, an admin) rather than picking blindly.
 *
 * Read-only. Refuses to run against production — there would be nothing
 * useful to print and it has no business reading production credentials.
 *
 * Usage:
 *   node scripts/staging/list-staging-logins.mjs
 */
import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, hostFromUri, dbNameFromUri, looksNonProduction } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const env = loadEnv(rootDir);

const STAGING_PASSWORD = "stagingpassword";

async function main() {
  const uri = env.STAGING_MONGODB_URI;
  if (!uri) throw new Error("STAGING_MONGODB_URI is not set in .env — see STAGING_SETUP.md");
  if (!looksNonProduction(uri)) {
    throw new Error(
      `STAGING_MONGODB_URI points at what looks like production ` +
        `(${hostFromUri(uri)}/${dbNameFromUri(uri)}). Refusing to list credentials.`
    );
  }

  const mongo = new MongoClient(uri);
  await mongo.connect();
  const db = mongo.db();

  const users = await db
    .collection("SYMXUsers")
    .find({}, { projection: { name: 1, email: 1, AppRole: 1, isActive: 1 } })
    .sort({ AppRole: 1, name: 1 })
    .toArray();

  const sites = await db.collection("SYMXSites").find({}).toArray();
  const assignments = await db.collection("SYMXUserSiteAssignments").find({ endDate: null }).toArray();
  const siteCodeById = new Map(sites.map((s) => [String(s._id), s.code]));
  const sitesByUser = new Map();
  for (const a of assignments) {
    const key = String(a.userId);
    if (!sitesByUser.has(key)) sitesByUser.set(key, []);
    sitesByUser.get(key).push(siteCodeById.get(String(a.siteId)) || "?");
  }

  const scrubbed = users.filter((u) => (u.email || "").endsWith("@staging.local"));
  if (scrubbed.length === 0) {
    console.log(
      "No scrubbed accounts found — this staging database was cloned WITHOUT --scrub,\n" +
        "so it still holds real emails and real password hashes (and real PII).\n" +
        "Log in with normal production credentials, or re-clone with --scrub."
    );
    await mongo.close();
    return;
  }

  console.log(`Database: ${dbNameFromUri(uri)}`);
  console.log(`Password for ALL accounts below: ${STAGING_PASSWORD}\n`);
  console.log(
    `  ${"EMAIL".padEnd(30)} ${"NAME".padEnd(24)} ${"ROLE".padEnd(18)} SITES`
  );
  console.log(`  ${"-".repeat(30)} ${"-".repeat(24)} ${"-".repeat(18)} -----`);
  for (const u of scrubbed) {
    const siteList = (sitesByUser.get(String(u._id)) || []).join(", ") || "(none)";
    const inactive = u.isActive === false ? " [inactive]" : "";
    console.log(
      `  ${String(u.email).padEnd(30)} ${String(u.name || "").slice(0, 24).padEnd(24)} ` +
        `${String(u.AppRole || "").slice(0, 18).padEnd(18)} ${siteList}${inactive}`
    );
  }

  console.log(
    `\n${scrubbed.length} account(s). Your SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD\n` +
      `from .env also work — that login path bypasses the database entirely.`
  );

  await mongo.close();
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
