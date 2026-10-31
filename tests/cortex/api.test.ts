import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectTestDb, disconnectTestDb, clearTestDb } from "../helpers/db";
import Site from "@/lib/models/Site";
import Observation from "@/lib/models/CortexObservation";
import { demoData } from "@/lib/cortex/fixtures";
import { intelligenceFixture } from "@/lib/cortex/intelligence-fixtures";
const auth = vi.hoisted(() => ({ allowed: true, siteId: "" }));
vi.mock("@/lib/auth/require-permission", () => ({
  requirePermission: async () => {
    if (!auth.allowed) throw new Error("Forbidden");
    return {};
  },
}));
vi.mock("@/lib/scoped-query", async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original,
    getRequestScope: async () => ({
      activeSiteIds: auth.siteId ? [auth.siteId] : [],
    }),
  };
});
import { POST } from "@/app/api/public/symx-cortex/route";
import { GET } from "@/app/api/cortex/route";
let site: any;
beforeAll(async () => {
  await connectTestDb();
  await Observation.createIndexes();
});
afterAll(disconnectTestDb);
beforeEach(async () => {
  await clearTestDb();
  auth.allowed = true;
  site = await Site.create({
    organizationId: new mongoose.Types.ObjectId(),
    name: "Synthetic DFO2",
    slug: "test-dfo2",
    code: "DFO2",
    amazon: { serviceAreaId: "safe-dfo2" },
    status: "active",
  });
  auth.siteId = String(site._id);
  process.env.SYMX_CORTEX_KEY = "test-cortex-key-not-production";
});
const capture = (overrides = {}) => ({
  captureId: crypto.randomUUID(),
  serviceAreaId: "safe-dfo2",
  date: demoData().date,
  observedAt: new Date().toISOString(),
  kind: "overview",
  routes: [demoData().routes[1]],
  ...overrides,
});
const post = (body: any, key = "test-cortex-key-not-production") =>
  POST(
    new NextRequest("http://localhost/api/public/symx-cortex", {
      method: "POST",
      headers: { "x-extension-key": key },
      body: JSON.stringify(body),
    }),
  );
const get = (query = "") =>
  GET(new NextRequest(`http://localhost/api/cortex${query}`));
describe("Cortex storage and security", () => {
  it("fails closed without a key and rejects invalid credentials", async () => {
    expect((await post(capture(), "bad")).status).toBe(401);
    delete process.env.SYMX_CORTEX_KEY;
    expect((await post(capture())).status).toBe(503);
  });
  it("rejects malformed timestamps, dates, future observations and unknown stations", async () => {
    expect((await post(capture({ observedAt: "broken" }))).status).toBe(400);
    expect(
      (
        await post(
          capture({ observedAt: new Date(Date.now() + 3600000).toISOString() }),
        )
      ).status,
    ).toBe(400);
    expect((await post(capture({ date: "2026-99-99" }))).status).toBe(400);
    expect((await get("?date=2026-02-30")).status).toBe(400);
    expect(
      (await post(capture({ serviceAreaId: "production-not-authorized" })))
        .status,
    ).toBe(403);
  });
  it("upserts retries idempotently and never regresses after an out-of-order delivery", async () => {
    const c = capture();
    const first = await post(c);
    expect(first.status).toBe(200);
    const retries = await Promise.all([post(c), post(c), post(c)]);
    expect(retries.every(response => response.status === 200)).toBe(true);
    expect(await Observation.countDocuments({ siteId: site._id })).toBe(1);
    await post(
      capture({
        observedAt: new Date(Date.now() - 600000).toISOString(),
        routes: [{ ...c.routes[0], completedStops: 1 }],
      }),
    );
    const result = await (await get()).json();
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].completedStops).toBe(c.routes[0].completedStops);
  });
  it("keeps stations isolated, fails closed for empty scope, and enforces permissions", async () => {
    await post(capture());
    auth.siteId = new mongoose.Types.ObjectId().toString();
    expect((await (await get()).json()).routes).toHaveLength(0);
    auth.siteId = "";
    expect((await (await get()).json()).routes).toHaveLength(0);
    auth.allowed = false;
    expect((await get()).status).toBe(403);
  });
  it("reconciles overview and detail into one historical driver/route/day row", async () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
    }).format(yesterday);
    const c = capture({ date, observedAt: yesterday.toISOString() });
    await post(c);
    await post(
      capture({
        date,
        observedAt: new Date(yesterday.getTime() + 60000).toISOString(),
        kind: "detail",
        routes: [{ ...c.routes[0], detail: true }],
      }),
    );
    const result = await (await get()).json();
    expect(result.history).toHaveLength(1);
  });
  it("persists allowlisted timing evidence and strips customer fields", async () => {
    const c = capture({ kind: "detail" });
    const timingEvidence = {
      inboundSource: "explicit_stem", inboundField: "valid", plannedRtsPresent: true,
      completePlan: true, deliveryStops: 159, deliveredTasks: 108,
      timestampedTasks: 108, timestampedStops: 66, rejectedTimestamps: 0,
      customerAddress: "PRIVATE CUSTOMER ADDRESS",
    };
    c.routes = [{ ...c.routes[0], timingEvidence, customerPhone: "PRIVATE PHONE" } as any];
    expect((await post(c)).status).toBe(200);
    const stored = await Observation.findOne({ siteId: site._id }).lean();
    expect((stored as any).timingEvidence.timestampedStops).toBe(66);
    expect(JSON.stringify(stored)).not.toContain("PRIVATE");
    const result = await (await get()).json();
    expect(result.routes[0].timingEvidence.inboundSource).toBe("explicit_stem");
    expect(result.routes[0].fieldObservedAt.inboundMinutes).toBe(c.observedAt);
  });
  it("cannot expose demo fixtures in production or tests", async () => {
    process.env.SYMX_CORTEX_DEMO = "true";
    expect((await get("?demo=1")).status).toBe(404);
  });
  it("persists only numeric stop events and derives signals on the server", async () => {
    const r = intelligenceFixture("slowdown");
    const c = capture({ kind: "detail", routes: [{ ...r, driverSignals: ["fake-client-signal"],
      deliveryEvents: r.deliveryEvents!.map(e => ({ ...e, address: "PRIVATE ADDRESS", trackingId: "PRIVATE TRACKING" })) }] });
    expect((await post(c)).status).toBe(200);
    const stored = await Observation.findOne({ siteId: site._id }).lean() as any;
    expect(stored.deliveryEvents).toHaveLength(r.deliveryEvents!.length);
    expect(stored.driverSignals).toContain("pace_drop");
    expect(JSON.stringify(stored)).not.toMatch(/PRIVATE|fake-client-signal/);
  });
  it("preserves recovered historical signals while sending compact daily pace", async () => {
    const at = Date.now() - 86400000;
    const slow = intelligenceFixture("slowdown", at);
    const recovered = { ...intelligenceFixture("steady", at + 10 * 60000), date: slow.date };
    for (const r of [slow, recovered]) expect((await post(capture({ date: r.date, observedAt: r.observedAt, kind: "detail", routes: [r] }))).status).toBe(200);
    const result = await (await get()).json();
    expect(result.history).toHaveLength(1);
    expect(result.history[0].recordedSignals).toContain("pace_drop");
    expect(result.history[0].historicalPace.rate).toBeCloseTo(12);
    expect(result.history[0].deliveryEvents).toBeUndefined();
    expect(result.history[0].signalSamples).toBeUndefined();
  });
  it("keeps confirmation samples ordered despite late-arriving captures and scopes them", async () => {
    const at = Date.now();
    for (const m of [0, 6, 12]) {
      const r = intelligenceFixture("slowdown", at - m * 60000);
      expect((await post(capture({ date: r.date, observedAt: r.observedAt, kind: "detail", routes: [r] }))).status).toBe(200);
    }
    const result = await (await get()).json();
    const samples = result.routes[0].signalSamples;
    expect(samples).toHaveLength(3);
    expect(Date.parse(samples[0].observedAt)).toBe(at);
    expect(samples[1].codes).toContain("pace_drop");
    auth.siteId = new mongoose.Types.ObjectId().toString();
    expect((await (await get()).json()).routes).toEqual([]);
  });
  it("marks driver reassignment without borrowing another driver's history", async () => {
    const at = Date.now();
    const old = intelligenceFixture("steady", at - 60000);
    const next = { ...intelligenceFixture("steady", at), driverId: "replacement-driver" };
    for (const r of [old, next]) await post(capture({ observedAt: r.observedAt, date: r.date, kind: "detail", routes: [r] }));
    const result = await (await get()).json();
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].driverId).toBe("replacement-driver");
    expect(result.routes[0].assignmentChanged).toBe(true);
  });
});
