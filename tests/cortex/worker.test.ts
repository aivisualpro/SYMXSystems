import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
function worker(state: any, fetcher: any) {
  let listener: any;
  const context: any = {
    URL,
    TextEncoder,
    AbortSignal,
    crypto: webcrypto,
    Date,
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
      tabs: { create: async () => ({ id: 123 }), remove: async () => {} },
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
    deliver: () => vm.runInContext("deliver()", context),
  };
}
const config = () => ({
  origin: "http://localhost:3000",
  enabled: true,
  key: "test-key",
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
  json: async () => ({ ok: true, captureId: JSON.parse(init.body).captureId }),
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
    expect(requests).toBe(0);
  });
});
