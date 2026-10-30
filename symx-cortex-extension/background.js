importScripts("adapter.js", "queue.js");
let lock = Promise.resolve();
const serial = (fn) => {
  const result = lock.then(fn);
  lock = result.catch(() => {});
  return result;
};
const stationCodes = ["DFO2", "DXC8", "DFO3"];
const day = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(
    new Date(),
  );
chrome.alarms.create("cortex-delivery", { periodInMinutes: 1 });
chrome.alarms.create("cortex-collection", { periodInMinutes: 1 });

async function deliver() {
  return serial(async () => {
    const {
      config,
      outbox = [],
      health = {},
      deadLetters = [],
    } = await chrome.storage.local.get([
      "config",
      "outbox",
      "health",
      "deadLetters",
    ]);
    if (!config?.enabled || !config.key) return;
    const origin = CortexQueue.endpoint(config.origin);
    // A single bounded request per tick; capture messages can also trigger a delivery.
    const item = outbox.find((x) => x.nextAttempt <= Date.now());
    if (!item) return;
    const station = config.stations.find(
      (s) => s.serviceAreaId === item.capture.serviceAreaId,
    )?.code;
    if (!station) {
      outbox.splice(outbox.indexOf(item), 1);
      deadLetters.push({
        ...item,
        error: "Station removed from local configuration",
      });
      await chrome.storage.local.set({
        outbox,
        deadLetters: deadLetters.slice(-20),
      });
      return;
    }
    const h = health[station] || {};
    h.lastAttemptAt = new Date().toISOString();
    let permanent = CortexQueue.expired(item, Date.now());
    try {
      if (permanent)
        throw new Error("Capture expired or retry budget exhausted");
      const response = await fetch(`${origin}/api/public/symx-cortex`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-extension-key": config.key,
        },
        body: JSON.stringify(item.capture),
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
      const ack = await response.json().catch(() => ({}));
      if (!response.ok || !ack.ok || ack.captureId !== item.capture.captureId) {
        permanent = [400, 403, 404, 413, 422].includes(response.status);
        const retrySeconds = Number(response.headers.get("retry-after"));
        item.nextAttempt = CortexQueue.retry(
          item.attempts,
          Date.now(),
          Number.isFinite(retrySeconds)
            ? Math.min(3600, Math.max(0, retrySeconds)) * 1000
            : 0,
        );
        throw new Error(`Sync HTTP ${response.status}`);
      }
      outbox.splice(outbox.indexOf(item), 1);
      health[station] = {
        ...h,
        lastSuccessAt: new Date().toISOString(),
        lastObservedAt: item.capture.observedAt,
        error: null,
      };
    } catch (e) {
      item.attempts++;
      item.nextAttempt = Math.max(
        item.nextAttempt,
        CortexQueue.retry(item.attempts, Date.now()),
      );
      health[station] = { ...h, error: e.message };
      if (permanent || CortexQueue.expired(item, Date.now())) {
        outbox.splice(outbox.indexOf(item), 1);
        // Failed payloads retain no raw responses, credentials, or customer addresses.
        deadLetters.push({ ...item, error: e.message });
      }
    }
    await chrome.storage.local.set({
      outbox,
      health,
      deadLetters: deadLetters.slice(-20),
    });
  });
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    message.type === "retry" &&
    sender.id === chrome.runtime.id &&
    sender.url === chrome.runtime.getURL("options.html")
  ) {
    serial(async () => {
      const { outbox = [], deadLetters = [] } = await chrome.storage.local.get([
        "outbox",
        "deadLetters",
      ]);
      const retryable = deadLetters.filter(
        (x) => Date.now() - Date.parse(x.capture.observedAt) < 7 * 86400000,
      );
      if (outbox.length + retryable.length > 300)
        throw new Error("Outbox full");
      await chrome.storage.local.set({
        outbox: [
          ...outbox.map((x) => ({ ...x, nextAttempt: Date.now() })),
          ...retryable.map((x) => ({
            ...x,
            attempts: 0,
            nextAttempt: Date.now(),
          })),
        ],
        deadLetters: deadLetters.filter((x) => !retryable.includes(x)),
      });
    })
      .then(() => respond({ ok: true }))
      .catch(() => respond({ ok: false }));
    return true;
  }
  if (
    !sender.tab ||
    !sender.url?.startsWith(
      "https://logistics.amazon.com/operations/execution/",
    )
  )
    return;
  if (message.type === "capture") {
    (async () => {
      const captureId = await serial(async () => {
        const { config, outbox = [] } = await chrome.storage.local.get([
          "config",
          "outbox",
        ]);
        if (
          !config?.enabled ||
          !config.stations.some(
            (s) =>
              s.serviceAreaId === message.payload?.serviceAreaId &&
              stationCodes.includes(s.code),
          )
        )
          throw new Error("Station disabled");
        const p = message.payload;
        if (!["overview", "detail"].includes(p.kind))
          throw new Error("Unsupported capture");
        const routes = CortexAdapter.normalize(p.data, p.kind);
        if (!routes.length || routes.length > 500)
          throw new Error("No compatible routes");
        const capture = {
          captureId: crypto.randomUUID(),
          serviceAreaId: p.serviceAreaId,
          date: p.date,
          observedAt: p.observedAt,
          kind: p.kind,
          routes,
        };
        if (JSON.stringify(capture).length > 1000000)
          throw new Error("Capture too large");
        // De-duplicate concurrent page notifications, but retain later observations for freshness/history.
        const fingerprintText = JSON.stringify([
          capture.serviceAreaId,
          capture.date,
          capture.kind,
          Math.floor(Date.parse(capture.observedAt) / 60000),
          routes,
        ]);
        const bytes = new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(fingerprintText),
          ),
        );
        const h = Array.from(bytes, (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        const fingerprint = h;
        capture.captureId = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
        const existing = outbox.find((x) => x.fingerprint === fingerprint);
        if (existing) return existing.capture.captureId;
        if (outbox.length >= 300)
          throw new Error("Outbox full; queued data preserved");
        outbox.push({
          capture,
          fingerprint,
          attempts: 0,
          nextAttempt: Date.now(),
        });
        await chrome.storage.local.set({ outbox });
        return capture.captureId;
      });
      await deliver();
      const { outbox = [], deadLetters = [] } = await chrome.storage.local.get([
        "outbox",
        "deadLetters",
      ]);
      const ok = ![...outbox, ...deadLetters].some(
        (x) => x.capture.captureId === captureId,
      );
      respond({ ok, queued: !ok });
    })().catch(() => respond({ ok: false }));
    return true;
  }
  if (message.type === "done") {
    serial(async () => {
      const { jobs = {}, health = {} } = await chrome.storage.local.get([
        "jobs",
        "health",
      ]);
      const job = jobs[sender.tab.id];
      if (job) {
        health[job.code] = {
          ...health[job.code],
          captureStatus: message.ok ? "complete" : "partial",
          captureDetail: String(message.detail || "").slice(0, 200),
          lastCollectionAt: new Date().toISOString(),
        };
        delete jobs[sender.tab.id];
        await chrome.storage.local.set({ jobs, health });
        await chrome.tabs.remove(sender.tab.id).catch(() => {});
      }
    });
    respond({ ok: true });
  }
});
async function collect() {
  return serial(async () => {
    const {
      config,
      jobs = {},
      health = {},
      lastScheduled = {},
    } = await chrome.storage.local.get([
      "config",
      "jobs",
      "health",
      "lastScheduled",
    ]);
    for (const [id, job] of Object.entries(jobs)) {
      if (Date.now() - job.started > 8 * 60000) {
        health[job.code] = {
          ...health[job.code],
          captureStatus: "timeout",
          captureDetail: "No complete capture; check authorized Chrome session",
        };
        await chrome.tabs.remove(Number(id)).catch(() => {});
        delete jobs[id];
      }
    }
    if (config?.enabled) {
      const hour = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Los_Angeles",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date()),
      );
      if (hour >= 7 && hour < 24)
        for (const st of config.stations || []) {
          if (
            !stationCodes.includes(st.code) ||
            !st.serviceAreaId ||
            Object.values(jobs).some((j) => j.code === st.code) ||
            Date.now() - (lastScheduled[st.code] || 0) < 10 * 60000
          )
            continue;
          const query = new URLSearchParams({
            provider: "ALL_DRIVERS",
            selectedDay: day(),
            serviceAreaId: st.serviceAreaId,
            symx_cortex_run: "1",
          });
          const tab = await chrome.tabs.create({
            url: `https://logistics.amazon.com/operations/execution/itineraries?${query}`,
            active: false,
          });
          jobs[tab.id] = { code: st.code, started: Date.now() };
          lastScheduled[st.code] = Date.now();
          break; // Stagger stations; never launch a burst of navigation.
        }
    }
    await chrome.storage.local.set({ jobs, health, lastScheduled });
  });
}
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "cortex-delivery") deliver().catch(() => {});
  if (alarm.name === "cortex-collection") collect().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  collect().catch(() => {});
  deliver().catch(() => {});
});
