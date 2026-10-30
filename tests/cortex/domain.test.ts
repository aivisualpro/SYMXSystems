import { describe, it, expect } from "vitest";
import {
  assessRoute,
  businessDate,
  captureSchema,
  latestRoutes,
} from "@/lib/cortex/domain";
import { demoData } from "@/lib/cortex/fixtures";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const now = Date.parse("2026-10-30T21:00:00Z");
const r = demoData(now).routes[1];
describe("Cortex route intelligence", () => {
  it("suppresses stale, unknown, and tiny-sample forecasts", () => {
    expect(
      assessRoute(
        { ...r, observedAt: new Date(now - 21 * 60000).toISOString() },
        now,
      ).forecast,
    ).toBeNull();
    expect(
      assessRoute({ ...r, inboundMinutes: null }, now).forecast,
    ).toBeNull();
    expect(assessRoute({ ...r, completedStops: 4 }, now).forecast).toBeNull();
    expect(
      assessRoute({ ...r, firstDelivery: now - 10 * 60000 }, now).forecast,
    ).toBeNull();
  });
  it("flags a likely late return and a late departure separately", () => {
    expect(assessRoute({ ...r, plannedReturn: now + 60000 }, now).risk).toBe(
      "delay",
    );
    expect(
      assessRoute(
        {
          ...r,
          firstDelivery: null,
          actualDeparture: null,
          plannedDeparture: now - 20 * 60000,
        },
        now,
      ).risk,
    ).toBe("late departure");
  });
  it("does not label a completed route as behind", () => {
    expect(assessRoute({ ...r, completedStops: r.totalStops }, now).risk).toBe(
      "complete",
    );
    expect(
      assessRoute({ ...r, actualReturn: now - 60000 }, now).forecast,
    ).toBeNull();
  });
  it("uses Pacific business dates across midnight and DST", () => {
    expect(businessDate(new Date("2026-10-30T03:00:00Z"))).toBe("2026-10-29");
    expect(businessDate(new Date("2026-11-01T09:30:00Z"))).toBe("2026-11-01");
  });
  it("keeps the newest route row while preserving station and day boundaries", () => {
    const old = {
      ...r,
      completedStops: 1,
      observedAt: new Date(now - 3600000).toISOString(),
    };
    const rows = latestRoutes([
      r,
      old,
      { ...r, station: "DFO3" },
      { ...r, date: "2026-10-29" },
      { ...r, driverId: "rescuer" },
    ]);
    expect(rows).toHaveLength(3);
    expect(
      rows.find(
        (x) =>
          x.station === r.station &&
          x.date === r.date &&
          x.driverId === r.driverId,
      )?.completedStops,
    ).toBe(r.completedStops);
  });
  it("merges a recent detail with a newer overview without counting the route twice", () => {
    const detail = {
      ...r,
      observedAt: new Date(now - 10 * 60000).toISOString(),
    };
    const overview = {
      ...r,
      detail: false,
      firstDelivery: null,
      inboundMinutes: null,
      observedAt: new Date(now).toISOString(),
      completedStops: 80,
    };
    const rows = latestRoutes([detail, overview]);
    expect(rows).toHaveLength(1);
    expect(rows[0].driverId).toBe(r.driverId);
    expect(rows[0].completedStops).toBe(80);
    expect(rows[0].firstDelivery).toBe(r.firstDelivery);
    expect(assessRoute(rows[0], now).forecast).not.toBeNull();
    expect(
      assessRoute(
        {
          ...rows[0],
          detailObservedAt: new Date(now - 21 * 60000).toISOString(),
        },
        now,
      ).forecast,
    ).toBeNull();
  });
  it("rejects impossible dates, duplicate rows, and invalid counts", () => {
    const payload = {
      captureId: "c831a23c-dc34-4c0d-a790-f9bba42b9c29",
      serviceAreaId: "demo",
      date: "2026-10-30",
      observedAt: new Date(now).toISOString(),
      kind: "overview",
      routes: [r],
    };
    expect(captureSchema.safeParse(payload).success).toBe(true);
    expect(
      captureSchema.safeParse({ ...payload, date: "2026-99-99" }).success,
    ).toBe(false);
    expect(
      captureSchema.safeParse({ ...payload, routes: [r, r] }).success,
    ).toBe(false);
    expect(
      captureSchema.safeParse({
        ...payload,
        routes: [{ ...r, completedStops: 9999 }],
      }).success,
    ).toBe(false);
  });
});
describe("dedicated extension normalizer and queue policy", () => {
  const context: any = { URL };
  vm.createContext(context);
  vm.runInContext(
    readFileSync("symx-cortex-extension/adapter.js", "utf8"),
    context,
  );
  vm.runInContext(
    readFileSync("symx-cortex-extension/queue.js", "utf8"),
    context,
  );
  it("normalizes overview counters without turning unknowns into zero", () => {
    const rows = context.CortexAdapter.normalize(
      {
        routeSummaries: [
          {
            routeCode: "CX1",
            routeId: "r1",
            stopProgress: { total: 100, completed: 20 },
          },
          { routeCode: "CX2" },
        ],
      },
      "overview",
    );
    expect(rows[0].completedStops).toBe(20);
    expect(rows[1].completedStops).toBeNull();
    expect(context.CortexAdapter.epoch(1793394000)).toBe(1793394000000);
    expect(context.CortexAdapter.epoch(1793394000000000)).toBe(1793394000000);
  });
  it("extracts delivery times and never returns customer addresses or phone fields", () => {
    const rows = context.CortexAdapter.normalize(
      {
        itineraryDetails: {
          itineraryId: "i1",
          transporterId: "d1",
          routes: [
            {
              routeCode: "CX1",
              routeDeliveryProgress: { totalStops: 10, completedStops: 3 },
            },
          ],
          transporterTimeAttributes: { plannedInboundStemTime: 900000 },
        },
        stops: [
          {
            routeCode: "CX1",
            sequenceNumber: 2,
            address: "Private address",
            tasks: [
              {
                taskType: "DROP_OFF",
                taskState: "DELIVERED",
                actualExecutionTime: 1793394000,
              },
            ],
          },
        ],
      },
      "detail",
    );
    expect(rows[0].firstDelivery).toBe(1793394000000);
    expect(rows[0].inboundMinutes).toBe(15);
    expect(JSON.stringify(rows)).not.toContain("Private");
  });
  it("rejects production origins and retries with bounded backoff", () => {
    expect(() =>
      context.CortexQueue.endpoint("https://symx-systems.vercel.app"),
    ).toThrow();
    expect(() => context.CortexQueue.endpoint("https://example.com")).toThrow();
    expect(context.CortexQueue.endpoint("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
    expect(context.CortexQueue.retry(1, 0)).toBe(30000);
    expect(context.CortexQueue.retry(99, 0)).toBe(3600000);
    expect(
      context.CortexQueue.expired(
        { attempts: 12, capture: { observedAt: new Date(now).toISOString() } },
        now,
      ),
    ).toBe(true);
  });
});
