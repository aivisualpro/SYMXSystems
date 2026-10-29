import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

let session: { id: string; role: string } | null = { id: "dispatcher", role: "Dispatcher" };
let actions: Record<string, boolean> = {};

vi.mock("@/lib/auth", () => ({ getSession: async () => session }));
vi.mock("@/lib/db", () => ({ default: async () => undefined }));
vi.mock("@/lib/models/SymxAppRole", () => ({
  default: {
    findById: () => ({ lean: () => Promise.resolve({ permissions: [{ module: "Scorecard", actions }] }) }),
    findOne: () => ({ lean: () => Promise.resolve(null) }),
  },
}));

import { requirePermission } from "@/lib/auth/require-permission";

afterEach(() => {
  session = { id: "dispatcher", role: "Dispatcher" };
  actions = {};
});

describe("Driver Rankings Scorecard permissions", () => {
  it("allows and blocks Dispatcher view access from Scorecard View", async () => {
    actions = { view: true };
    await expect(requirePermission("Scorecard", "view")).resolves.toMatchObject({ role: "Dispatcher" });
    actions = { view: false };
    await expect(requirePermission("Scorecard", "view")).rejects.toThrow("Missing permission: view on Scorecard");
  });

  it("allows and blocks imports from Scorecard Edit", async () => {
    actions = { edit: true };
    await expect(requirePermission("Scorecard", "edit")).resolves.toMatchObject({ role: "Dispatcher" });
    actions = { edit: false };
    await expect(requirePermission("Scorecard", "edit")).rejects.toThrow("Missing permission: edit on Scorecard");
  });

  it("preserves the Super Admin bypass", async () => {
    session = { id: "super-admin", role: "Super Admin" };
    actions = { view: false, edit: false };
    await expect(requirePermission("Scorecard", "view")).resolves.toMatchObject({ role: "Super Admin" });
    await expect(requirePermission("Scorecard", "edit")).resolves.toMatchObject({ role: "Super Admin" });
  });

  it("uses Scorecard consistently across every Driver Rankings API route", () => {
    const routes = [
      "app/api/driver-rankings/route.ts",
      "app/api/driver-rankings/export/route.ts",
      "app/api/driver-rankings/history/route.ts",
      "app/api/driver-rankings/team/route.ts",
      "app/api/driver-rankings/settings/route.ts",
      "app/api/driver-rankings/driver-link/route.ts",
      "app/api/driver-rankings/quality-detail-import/route.ts",
      "app/api/driver-rankings/weekly-scorecard-import/route.ts",
    ].map(path => readFileSync(path, "utf8")).join("\n");

    expect(routes).not.toContain('"Driver Dashboard"');
    expect(routes).toContain('requirePermission("Scorecard", "view")');
    expect(routes).toContain('requirePermission("Scorecard", "edit")');
    expect(routes).toContain('hasPermission(session, "Scorecard", "edit")');
  });
});
