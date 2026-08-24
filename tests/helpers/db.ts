/**
 * In-memory MongoDB harness for integration tests.
 *
 * Each test FILE gets its own server + database. Tests never touch a real
 * cluster — tests/setup.ts strips any non-local MONGODB_URI from the
 * environment before this module is imported.
 *
 * Usage:
 *   beforeAll(async () => { await connectTestDb(); });
 *   afterEach(async () => { await clearTestDb(); });
 *   afterAll(async () => { await disconnectTestDb(); });
 */
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer: MongoMemoryServer | null = null;

export async function connectTestDb(): Promise<typeof mongoose> {
  if (mongoServer) return mongoose;

  try {
    mongoServer = await MongoMemoryServer.create();
  } catch (err: any) {
    // mongodb-memory-server downloads a mongod binary on first run. In
    // sandboxed CI or restricted networks that download fails, and the raw
    // error ("Status Code is 403") is misleading — it reads like a bad
    // version rather than a blocked network. Fail with something actionable.
    throw new Error(
      "Could not start an in-memory MongoDB instance.\n\n" +
        "These are integration tests and require a real mongod binary.\n" +
        "Options:\n" +
        "  1. Run on a machine with outbound access to fastdl.mongodb.org (first run downloads once, then caches).\n" +
        "  2. Point at an already-installed mongod:  export MONGOMS_SYSTEM_BINARY=/usr/bin/mongod\n" +
        "  3. Pin a version available for your platform: export MONGOMS_VERSION=7.0.14\n\n" +
        `Underlying error: ${err?.message || err}`
    );
  }

  const uri = mongoServer.getUri();

  // Point lib/db.ts at the in-memory instance too, so any code path that calls
  // connectToDatabase() during a test reuses this connection rather than
  // attempting a real one.
  process.env.MONGODB_URI = uri;

  await mongoose.connect(uri);
  return mongoose;
}

/**
 * Wipes every collection between tests without tearing down the server —
 * much faster than recreating the instance, and guarantees no state bleeds
 * from one test into the next (which would silently invalidate isolation
 * assertions).
 */
export async function clearTestDb(): Promise<void> {
  if (!mongoose.connection.db) return;
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function disconnectTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

/**
 * Forces Mongoose to build the indexes declared on a model. In-memory Mongo
 * does not auto-build them, and several isolation tests depend on unique
 * constraints actually being enforced (e.g. proving that a compound
 * {siteId, date} index permits the same date at two different sites while a
 * global unique index would not).
 */
export async function ensureIndexes(...models: mongoose.Model<any>[]): Promise<void> {
  await Promise.all(models.map((m) => m.createIndexes()));
}
