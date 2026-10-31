/** Isolated, disposable preview. Does not read .env files or connect to a remote database. */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
if (process.env.NODE_ENV === "production")
  throw new Error("This disposable preview cannot run in production");
const statePath =
  process.env.CORTEX_PREVIEW_STATE || "/tmp/symx-cortex-preview.json";
const mongod = await MongoMemoryServer.create({
  instance: { dbName: "symx-cortex-disposable" },
});
const uri = mongod.getUri("symx-cortex-disposable");
const password = randomBytes(24).toString("hex");
const key = randomBytes(32).toString("hex");
// Random local-only login and key are stored privately for local validation; never logged or committed.
writeFileSync(
  statePath,
  JSON.stringify({ email: "preview@cortex.test", password, key, uri }),
  { mode: 0o600 },
);
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "development",
      MONGODB_URI: uri,
      DEVELOPMENT_MONGODB_URI: uri,
      JWT_SECRET: randomBytes(32).toString("hex"),
      SUPER_ADMIN_EMAIL: "preview@cortex.test",
      SUPER_ADMIN_PASSWORD: password,
      SYMX_CORTEX_KEY: key,
      SYMX_CORTEX_DEMO: "true",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  child.kill("SIGTERM");
  await mongod.stop();
  try {
    unlinkSync(statePath);
  } catch {}
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", async (code) => {
  await stop();
  process.exitCode = code || 0;
});
