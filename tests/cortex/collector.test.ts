import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
function collector(count = 4, mode: "normal" | "timeout" | "throttle" = "normal") {
  vi.useFakeTimers();
  const location = new URL("https://logistics.amazon.com/operations/execution/itineraries?selectedDay=2026-10-30&serviceAreaId=synthetic&symx_cortex_run=1");
  const listeners: Record<string, any[]> = {};
  const messages: any[] = [], navigations: number[] = [];
  const overview = { routeSummaries: Array.from({ length: count }, (_, i) => ({ routeId: `route-${i}`, routeCode: `CX${i}` })) };
  const window: any = {
    addEventListener: (name: string, fn: any) => { (listeners[name] ||= []).push(fn); },
    postMessage: (message: any) => {
      messages.push(message);
      if (message.type === "capture" && (message.payload.kind === "overview" || mode !== "timeout")) {
        for (const fn of listeners.message || []) fn({ source: window, origin: location.origin,
          data: { source: "SYMX_CORTEX_BRIDGE", id: message.id, ok: true } });
      }
    },
    fetch: async (url: string) => ({
      ok: !(mode === "throttle" && url.includes("/api/itineraries/")),
      status: mode === "throttle" && url.includes("/api/itineraries/") ? 429 : 200,
      clone: () => ({ json: async () => url.includes("/api/itineraries/")
        ? { itineraryDetails: { itineraryId: url.split("/api/itineraries/")[1], routes: [{ routeCode: "CX0" }] } }
        : overview }),
    }),
    dispatchEvent: () => {
      if (location.pathname.includes("/documentType/")) {
        navigations.push(Date.now());
        void window.fetch(`/execution/api/itineraries/${location.pathname.split("/itineraries/")[1].split("/")[0]}`);
      }
    },
  };
  class XHR { addEventListener() {} open() {} }
  const context = { window, location, URL, URLSearchParams, crypto: webcrypto, Date,
    setTimeout, clearTimeout, setInterval, clearInterval, XMLHttpRequest: XHR,
    PopStateEvent: class {}, history: { pushState: (_: any, __: any, url: string) => { location.href = new URL(url, location.origin).href; } },
  };
  vm.runInNewContext(readFileSync("symx-cortex-extension/collector.js", "utf8"), context);
  return { window, messages, navigations,
    start: () => window.fetch("/execution/api/summaries"),
    done: () => messages.findLast(m => m.type === "done"),
  };
}
afterEach(() => vi.useRealTimers());
describe("read-only collection scheduling", () => {
  it("paces 40 distinct targets and reports acknowledged coverage without IDs", async () => {
    const c = collector(40); await c.start(); await vi.advanceTimersByTimeAsync(60000);
    expect(c.navigations).toHaveLength(40);
    expect(c.navigations.every((t, i) => i === 0 || t - c.navigations[i - 1] >= 1000)).toBe(true);
    expect(c.done()).toMatchObject({ ok: true, reason: "finished", coverage: { expected: 40, acknowledged: 40, timedOut: 0, skipped: 0 } });
    expect(JSON.stringify(c.messages.filter(m => m.type !== "capture"))).not.toContain("route-");
  });
  it("skips a detail already acknowledged through passive observation", async () => {
    const c = collector(); await c.start();
    await c.window.fetch("/execution/api/itineraries/route-0");
    await vi.advanceTimersByTimeAsync(15000);
    expect(c.navigations).toHaveLength(3);
    expect(c.done().coverage.acknowledged).toBe(4);
  });
  it("stops after three consecutive timeouts and reports the unattempted remainder", async () => {
    const c = collector(10, "timeout"); await c.start(); await vi.advanceTimersByTimeAsync(130000);
    expect(c.navigations).toHaveLength(3);
    expect(c.done()).toMatchObject({ ok: false, reason: "stalled", coverage: { expected: 10, acknowledged: 0, timedOut: 3, skipped: 7 } });
  });
  it("stops on Amazon throttling without retrying or restoring overview", async () => {
    const c = collector(10, "throttle"); await c.start(); await vi.advanceTimersByTimeAsync(15000);
    expect(c.navigations).toHaveLength(1);
    expect(c.done()).toMatchObject({ ok: false, reason: "access" });
  });
  it("reports a missing signed-in overview without launching detail requests", async () => {
    const c = collector(); await vi.advanceTimersByTimeAsync(95000);
    expect(c.navigations).toHaveLength(0);
    expect(c.done()).toMatchObject({ ok: false, reason: "no_overview" });
  });
});
