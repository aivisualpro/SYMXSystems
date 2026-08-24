import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Node environment — these are server-side tests (models, auth, scoping,
    // API handlers). Component tests, if added later, should live in a second
    // project with a jsdom environment rather than switching this one.
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    // Each suite spins up its own in-memory MongoDB. Running files in parallel
    // against a shared connection causes cross-test interference, so keep the
    // pool single-forked until the suite is large enough to justify sharding.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    // In-memory Mongo can take a few seconds to download/boot on a cold run.
    testTimeout: 30000,
    hookTimeout: 60000,
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: ["**/*.d.ts", "lib/models/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
