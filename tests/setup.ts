/**
 * Global test setup — runs once per test file, before any test.
 *
 * Deliberately does NOT connect to a database here. Suites that need one call
 * `connectTestDb()` from tests/helpers/db.ts in their own beforeAll, so that
 * pure unit tests (no DB) stay fast and don't pay for a Mongo boot.
 */

// Never let a test accidentally reach the real database. If a test imports
// something that calls lib/db.ts, this makes the failure loud and obvious
// rather than silently connecting to production.
const REAL_URI_VARS = ["MONGODB_URI", "DEVELOPMENT_MONGODB_URI", "MONGO_URI"];
for (const v of REAL_URI_VARS) {
  if (process.env[v] && !process.env[v]!.includes("127.0.0.1") && !process.env[v]!.includes("localhost")) {
    delete process.env[v];
  }
}

// lib/db.ts throws at IMPORT time if MONGODB_URI is unset, so a harmless
// localhost placeholder has to exist before any module that imports it is
// evaluated. connectTestDb() overwrites this with the real in-memory URI
// before anything actually connects — nothing ever dials this address.
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/symx-test-placeholder";

// Deterministic values for anything that reads config at import time.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-not-used-in-production";
process.env.SUPER_ADMIN_EMAIL = "superadmin@test.local";
process.env.SUPER_ADMIN_PASSWORD = "test-super-admin-password";

export {};
