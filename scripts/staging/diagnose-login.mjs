#!/usr/bin/env node
/**
 * Reproduces the app's login path against a database, step by step, so a
 * failure points at the actual cause instead of a generic 500.
 *
 * The login route wraps everything in one try/catch that returns
 * "Authentication failed" for ANY thrown error — a DB connection problem
 * and a bcrypt problem look identical from the browser. This walks the
 * same sequence and reports which step broke.
 *
 * Read-only. Never writes, never creates a session.
 *
 * Usage:
 *   node scripts/staging/diagnose-login.mjs user627b50@staging.local
 *   node scripts/staging/diagnose-login.mjs user627b50@staging.local mypassword
 */
import { MongoClient } from "mongodb";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv, hostFromUri, dbNameFromUri } from "../lib/target-db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const env = loadEnv(rootDir);

const email = (process.argv[2] || "").toLowerCase();
const password = process.argv[3] || "stagingpassword";

if (!email) {
  console.error("Usage: node scripts/staging/diagnose-login.mjs <email> [password]");
  process.exit(1);
}

const step = (n, msg) => console.log(`\n${n}. ${msg}`);
const ok = (msg) => console.log(`   ✓ ${msg}`);
const bad = (msg) => console.log(`   ✗ ${msg}`);

async function main() {
  // ── 0. Which database would the APP use? ──
  // Next.js loads .env.local with higher precedence than .env, so the app
  // and these scripts can easily be pointed at different databases without
  // it being obvious.
  step(0, "Resolving which database the APP would use");
  const localPath = path.join(rootDir, ".env.local");
  const hasLocal = fs.existsSync(localPath);
  let appUri = env.MONGODB_URI;
  let appSource = ".env";

  if (hasLocal) {
    const localEnv = {};
    for (const line of fs.readFileSync(localPath, "utf-8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=["']?(.*?)["']?\s*$/);
      if (m) localEnv[m[1]] = m[2];
    }
    if (localEnv.MONGODB_URI) {
      appUri = localEnv.MONGODB_URI;
      appSource = ".env.local (overrides .env)";
    }
    ok(`.env.local exists`);
  } else {
    bad(`.env.local does NOT exist — the app is using MONGODB_URI from .env`);
  }

  console.log(`   App would connect to: ${hostFromUri(appUri)} / ${dbNameFromUri(appUri)}`);
  console.log(`   Source: ${appSource}`);

  const stagingDb = dbNameFromUri(env.STAGING_MONGODB_URI || "");
  const appDb = dbNameFromUri(appUri);
  if (stagingDb && appDb !== stagingDb) {
    bad(
      `MISMATCH: the app points at "${appDb}" but your staging database is ` +
        `"${stagingDb}".\n     A @staging.local account only exists in "${stagingDb}".`
    );
  } else if (stagingDb) {
    ok(`App is pointed at the staging database`);
  }

  // Everything below tests the database the APP would actually use.
  step(1, `Connecting to ${dbNameFromUri(appUri)}`);
  const mongo = new MongoClient(appUri, { serverSelectionTimeoutMS: 8000 });
  try {
    await mongo.connect();
    ok("Connected");
  } catch (e) {
    bad(`Connection FAILED — this is what produces "Authentication failed" (a 500)`);
    console.log(`     ${e.message}`);
    console.log(`\n   Likely causes: wrong credentials in the URI, or your IP is not on`);
    console.log(`   the Atlas Network Access allow-list.`);
    process.exit(1);
  }

  const db = mongo.db();

  step(2, `Looking up user: ${email}`);
  const user = await db.collection("SYMXUsers").findOne({ email });
  if (!user) {
    bad(`No user with that email in "${dbNameFromUri(appUri)}"`);
    const sample = await db
      .collection("SYMXUsers")
      .find({}, { projection: { email: 1 } })
      .limit(5)
      .toArray();
    console.log(`\n   Emails that DO exist here (first 5):`);
    sample.forEach((u) => console.log(`     ${u.email}`));
    console.log(`\n   Note: the app returns "Invalid email or password" for this case,`);
    console.log(`   not "Authentication failed" — so this is probably not your issue.`);
    await mongo.close();
    process.exit(1);
  }
  ok(`Found: ${user.name} (role: ${user.AppRole})`);

  step(3, "Checking the stored password hash");
  if (!user.password) {
    bad("User has NO password field — login returns 401");
    await mongo.close();
    process.exit(1);
  }
  const isBcrypt = user.password.startsWith("$2");
  console.log(`   Length: ${user.password.length} (bcrypt = 60)`);
  console.log(`   Prefix: ${user.password.slice(0, 7)}`);
  if (!isBcrypt) {
    console.log(`   → Treated as LEGACY PLAINTEXT by the login route`);
    if (user.password === password) ok("Plaintext matches");
    else bad("Plaintext does NOT match");
  } else {
    ok("Looks like a bcrypt hash");
  }

  step(4, `Verifying password "${password}"`);
  if (isBcrypt) {
    try {
      const valid = await bcrypt.compare(password, user.password);
      if (valid) ok("PASSWORD MATCHES — this account can log in");
      else {
        bad("Password does NOT match this hash");
        console.log(`     The app would return 401 "Invalid email or password".`);
      }
    } catch (e) {
      bad(`bcrypt.compare THREW — this produces "Authentication failed" (a 500)`);
      console.log(`     ${e.message}`);
    }
  }

  step(5, "Checking account is active");
  if (user.isActive === false) {
    bad("Account is INACTIVE — login returns 403");
  } else {
    ok("Active");
  }

  console.log("");
  await mongo.close();
}

main().catch((e) => {
  console.error(`\nDiagnostic itself failed: ${e.message}`);
  process.exit(1);
});
