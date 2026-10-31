import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
function worker(state: any, fetcher: any, clock: typeof Date = Date) {
  let listener: any;
  const closedTabs: number[] = [];
  const openedTabs: any[] = [];
  const context: any = {
    URL,
    URLSearchParams,
    TextEncoder,
    AbortSignal,
    crypto: webcrypto,
    Date: clock,
    setTimeout,
    clearTimeout,
    fetch: fetcher,
    chrome: {
      runtime: {
        id: "test",
        getURL: (s: string) => `chrome-extension://test/${s}`,
        onMessage: {
          addListener: (f: any) => {
            listener = f;
          },
        },
        onStartup: { addListener() {} },
      },
      storage: {
        local: {
          get: async (keys: string[]) =>
            Object.fromEntries(keys.map((k) => [k, structuredClone(state[k])])),
          set: async (values: any) =>
            Object.assign(state, structuredClone(values)),
        },
      },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      tabs: {
        create: async (options: any) => { openedTabs.push(options); return { id: 123 }; },
        remove: async (id: number) => {
          closedTabs.push(id);
        },
      },
    },
  };
  vm.createContext(context);
  context.importScripts = (...files: string[]) =>
    files.forEach((f) =>
      vm.runInContext(
        readFileSync(`symx-cortex-extension/${f}`, "utf8"),
        context,
      ),
    );
  vm.runInContext(
    readFileSync("symx-cortex-extension/background.js", "utf8"),
    context,
  );
  return {
    send: (message: any) =>
      new Promise<any>((resolve) =>
        listener(
          message,
          {
            id: "test",
            tab: { id: 1 },
            url: "https://logistics.amazon.com/operations/execution/itineraries",
          },
          resolve,
        ),
      ),
    options: (message: any) =>
      new Promise<any>((resolve) =>
        listener(
          message,
          { id: "test", url: "chrome-extension://test/options.html" },
          resolve,
        ),
      ),
    manual: (sender: any) => new Promise<any>(resolve => {
      const waiting = listener({ type: "collect-now" }, sender, resolve);
      if (waiting !== true) resolve(null);
    }),
    openedTabs,
    closedTabs,
    drain: () => vm.runInContext("drain()", context),
    deliver: () => vm.runInContext("deliver()", context),
  };
}
const config = () => ({
  origin: "http://localhost:3000",
  enabled: true,
  key: "test-development-key",
  stations: [{ code: "DFO2", serviceAreaId: "safe-dfo2" }],
});
const message = () => ({
  type: "capture",
  payload: {
    serviceAreaId: "safe-dfo2",
    date: "2026-10-30",
    observedAt: new Date().toISOString(),
    kind: "overview",
    data: {
      routeSummaries: [
        {
          routeCode: "CX1",
          routeId: "r1",
          stopProgress: { total: 100, completed: 20 },
        },
      ],
    },
  },
});
const ack = async (_url: any, init: any) => ({
  ok: true,
  status: 200,
  json: async () => ({
    ok: true,
    captureId: JSON.parse(init.body).captureId,
    accepted: JSON.parse(init.body).routes.length,
  }),
});
describe("durable MV3 delivery", () => {
  it("queues on outage, survives a worker restart, and acknowledges only confirmed writes", async () => {
    const state: any = { config: config() };
    const first = worker(state, async () => {
      throw new Error("offline");
    });
    expect((await first.send(message())).ok).toBe(false);
    expect(state.outbox).toHaveLength(1);
    expect(state.outbox[0].attempts).toBe(1);
    expect(state.health.DFO2.lastSuccessAt).toBeUndefined();
    const id = state.outbox[0].capture.captureId;
    state.outbox[0].nextAttempt = 0;
    const restarted = worker(state, async (url: any, init: any) => {
      expect(JSON.parse(init.body).captureId).toBe(id);
      return ack(url, init);
    });
    await restarted.deliver();
    expect(state.outbox).toHaveLength(0);
    expect(state.health.DFO2.lastSuccessAt).toBeTruthy();
  });
  it("deduplicates simultaneous captures and keeps stable IDs after acknowledgement", async () => {
    const state: any = { config: config() };
    const ids: string[] = [];
    const w = worker(state, async (url: any, init: any) => {
      ids.push(JSON.parse(init.body).captureId);
      return ack(url, init);
    });
    const m = message();
    await Promise.all([w.send(m), w.send(m), w.send(m)]);
    await w.send(m);
    expect(ids).toHaveLength(1);
    expect(new Set(ids).size).toBe(1);
    expect(state.outbox).toHaveLength(0);
  });
  it("retains permanent failure evidence and never records success for rejected writes", async () => {
    const state: any = { config: config() };
    const w = worker(state, async () => ({
      ok: false,
      status: 403,
      headers: new Headers(),
      json: async () => ({ error: "Unauthorized station" }),
    }));
    expect((await w.send(message())).ok).toBe(false);
    expect(state.outbox).toHaveLength(0);
    expect(state.deadLetters).toHaveLength(1);
    expect(state.health.DFO2.lastSuccessAt).toBeUndefined();
  });
  it("does not repeatedly send captures when the ingest key is rejected", async () => {
    const state: any = { config: config() };
    let requests = 0;
    const w = worker(state, async () => {
      requests++;
      return {
        ok: false,
        status: 401,
        headers: new Headers(),
        json: async () => ({ error: "Invalid ingest key" }),
      };
    });
    expect((await w.send(message())).ok).toBe(false);
    expect(state.outbox).toHaveLength(0);
    expect(state.deadLetters).toHaveLength(1);
    expect(state.health.DFO2.lastSuccessAt).toBeUndefined();
    await w.deliver();
    expect(requests).toBe(1);
  });
  it("does nothing without opt-in or for an unauthorized station", async () => {
    const state: any = { config: { ...config(), enabled: false } };
    let requests = 0;
    const w = worker(state, async (...args: any[]) => {
      requests++;
      return ack(args[0], args[1]);
    });
    expect((await w.send(message())).ok).toBe(false);
    expect(requests).toBe(0);
    state.config.enabled = true;
    expect(
      (
        await w.send({
          ...message(),
          payload: { ...message().payload, serviceAreaId: "other" },
        })
      ).ok,
    ).toBe(false);
    expect(requests).toBe(1); // Authoritative mapping lookup is permitted; ingestion is not.
    expect(state.outbox || []).toHaveLength(0);
  });
});

function queued(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    capture: {
      captureId: webcrypto.randomUUID(),
      observedAt: new Date().toISOString(),
      serviceAreaId: "safe-dfo2",
      routes: [{ routeCode: `CX${i}` }],
    },
    attempts: 0,
    nextAttempt: 0,
  }));
}
describe("outage catch-up and settings transactions", () => {
  it("drains a bounded batch and shares concurrent drain calls", async () => {
    const state: any = { config: config(), outbox: queued(43) };
    let sent = 0;
    const w = worker(state, async (...args: any[]) => {
      sent++;
      return ack(args[0], args[1]);
    });
    await Promise.all([w.drain(), w.drain()]);
    expect(sent).toBe(40);
    expect(state.outbox).toHaveLength(3);
    await w.drain();
    expect(sent).toBe(43);
    expect(state.outbox).toHaveLength(0);
    expect(Object.keys(state.receipts)).toHaveLength(43);
  });
  it("yields after the time budget even when a batch has room", async () => {
    let tick = Date.now();
    class Clock extends Date {
      static now() {
        return tick;
      }
    }
    const state: any = { config: config(), outbox: queued(5) };
    const w = worker(
      state,
      async (...args: any[]) => {
        tick += 21000;
        return ack(args[0], args[1]);
      },
      Clock,
    );
    await w.drain();
    expect(state.outbox).toHaveLength(4);
  });
  it("stops catch-up immediately on transient failure", async () => {
    const state: any = { config: config(), outbox: queued(10) };
    let attempts = 0;
    const w = worker(state, async () => {
      attempts++;
      throw new Error("offline");
    });
    await w.drain();
    expect(attempts).toBe(1);
    expect(state.outbox).toHaveLength(10);
  });
  it("never moves observed freshness backwards when replaying old data", async () => {
    const latest = new Date().toISOString();
    const state: any = {
      config: config(),
      outbox: queued(1),
      health: { DFO2: { lastObservedAt: latest } },
    };
    state.outbox[0].capture.observedAt = new Date(
      Date.now() - 3600000,
    ).toISOString();
    await worker(state, ack).deliver();
    expect(state.health.DFO2.lastObservedAt).toBe(latest);
  });
  it("requires an explicit acknowledgement of every submitted route", async () => {
    const state: any = { config: config() };
    const w = worker(state, async (_url: any, init: any) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        ok: true,
        captureId: JSON.parse(init.body).captureId,
        accepted: 0,
      }),
    }));
    expect((await w.send(message())).ok).toBe(false);
    expect(Object.keys(state.receipts || {})).toHaveLength(0);
    expect(state.outbox).toHaveLength(1);
  });
  it("cannot redirect a capture queued concurrently with settings changes", async () => {
    const state: any = { config: config() };
    const w = worker(state, async () => {
      throw new Error("offline");
    });
    const results = await Promise.all([
      w.send(message()),
      w.options({
        type: "configure",
        config: {
          ...config(),
          key: "test-development-key",
          origin: "http://localhost:4000",
        },
      }),
    ]);
    expect(results[1].ok).toBe(false);
    expect(state.config.origin).toBe("http://localhost:3000");
    expect(state.outbox).toHaveLength(1);
  });
  it("clears environment-specific receipts after a permitted origin switch", async () => {
    const state: any = { config: config() };
    const origins: string[] = [];
    const w = worker(state, async (url: any, init: any) => {
      origins.push(url);
      return ack(url, init);
    });
    const m = message();
    expect((await w.send(m)).ok).toBe(true);
    expect(
      (
        await w.options({
          type: "configure",
          config: {
            ...config(),
            key: "test-development-key",
            origin: "http://localhost:4000",
          },
        })
      ).ok,
    ).toBe(true);
    expect((await w.send(m)).ok).toBe(true);
    expect(origins).toEqual([
      "http://localhost:3000/api/public/symx-cortex",
      "http://localhost:4000/api/public/symx-cortex",
    ]);
  });
  it("closes only extension-owned jobs when disabled and rejects invalid settings", async () => {
    const state: any = { config: config(), jobs: { 123: { code: "DFO2" } } };
    const w = worker(state, ack);
    expect(
      (
        await w.options({
          type: "configure",
          config: {
            ...config(),
            key: "test-development-key",
            origin: "https://symx-systems.vercel.app",
          },
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await w.options({
          type: "configure",
          config: { ...config(), key: "test-development-key", enabled: false },
        })
      ).ok,
    ).toBe(true);
    expect(state.jobs).toEqual({});
    expect(w.closedTabs).toEqual([123]);
    expect(state.health.DFO2.captureStatus).toBe("cancelled");
  });
});

describe("manual collection entry points", () => {
  it("starts DFO2 when settings are open as a normal extension tab", async () => {
    const state: any = { config: config() }; const w = worker(state, ack);
    const result = await w.manual({ id: "test", url: "chrome-extension://test/options.html", tab: { id: 999 } });
    expect(result?.ok).toBe(true); expect(state.jobs[123].code).toBe("DFO2");
    expect(w.openedTabs[0].active).toBe(true);
  });
  it("keeps the toolbar popup working without a sender URL", async () => {
    const state: any = { config: config() }; const w = worker(state, ack);
    expect((await w.manual({ id: "test" }))?.ok).toBe(true);
  });
  it("does not accept collect commands from the Amazon content script", async () => {
    const state: any = { config: config() }; const w = worker(state, ack);
    expect(await w.manual({ id: "test", url: "https://logistics.amazon.com/operations/execution/itineraries", tab: { id: 999 } })).toBeNull();
    expect(state.jobs).toBeUndefined();
  });
});

describe("collection health and delivery scheduling", () => {
  it("acknowledges a current capture without waiting for an older backlog", async () => {
    const state: any = { config: config(), outbox: queued(5) };
    expect((await worker(state, ack).send(message())).ok).toBe(true);
    expect(state.outbox).toHaveLength(5);
    expect(state.health.DFO2.lastRoundTripMs).toBeGreaterThanOrEqual(0);
    expect(state.health.DFO2.observedToAckMs).toBeGreaterThanOrEqual(0);
  });
  it("stores numeric coverage and fixed reasons, excluding page diagnostics", async () => {
    const state: any = { config: config(), jobs: { 1: { code: "DFO2", started: Date.now() } } };
    const w = worker(state, ack);
    await w.send({ type: "progress", coverage: { expected: 40, acknowledged: 12, durationMs: 16000 },
      detail: "PRIVATE CUSTOMER ADDRESS", reason: "PRIVATE CUSTOMER ADDRESS" });
    expect(state.health.DFO2.captureStatus).toBe("collecting");
    expect(state.health.DFO2.coverage.acknowledged).toBe(12);
    expect(JSON.stringify(state.health)).not.toContain("PRIVATE");
    expect(w.closedTabs).toHaveLength(0);
    await w.send({ type: "done", ok: true, reason: "finished", coverage: { expected: 40, acknowledged: 12, overviewAcknowledged: true } });
    expect(state.health.DFO2.captureStatus).toBe("partial");
    expect(w.closedTabs).toEqual([1]);
  });
  it("does not let progress from a non-owned page overwrite a collection", async () => {
    const state: any = { config: config(), jobs: { 123: { code: "DFO2" } } };
    await worker(state, ack).send({ type: "done", ok: true, coverage: { expected: 1, acknowledged: 1 } });
    expect(state.jobs[123]).toBeTruthy();
    expect(state.health).toBeUndefined();
  });
  it("does not open a second manual DFO2 job", async () => {
    const state: any = { config: config(), jobs: { 123: { code: "DFO2", started: Date.now() } } };
    const w = worker(state, ack);
    expect((await w.manual({ id: "test" })).ok).toBe(false);
    expect(w.openedTabs).toHaveLength(0);
  });
});
