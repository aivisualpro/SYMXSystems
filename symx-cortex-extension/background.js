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

async function deliver(preferredCaptureId) {
  return serial(async () => {
    const {
      config,
      outbox = [],
      health = {},
      deadLetters = [],
      receipts = {},
    } = await chrome.storage.local.get([
      "config",
      "outbox",
      "health",
      "deadLetters",
      "receipts",
    ]);
    if (!config?.enabled || !config.key) return;
    const origin = CortexQueue.endpoint(config.origin);
    // One transaction per request; catch-up releases the lock between requests.
    const item = outbox.find(x => x.capture.captureId === preferredCaptureId && x.nextAttempt <= Date.now()) ||
      outbox.find((x) => x.nextAttempt <= Date.now());
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
      return "rejected";
    }
    const h = health[station] || {};
    h.lastAttemptAt = new Date().toISOString();
    let permanent = CortexQueue.expired(item, Date.now());
    let outcome = "sent";
    const requestStarted = Date.now();
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
      if (
        !response.ok ||
        !ack.ok ||
        ack.captureId !== item.capture.captureId ||
        ack.accepted !== item.capture.routes.length
      ) {
        // Credentials and station authorization cannot recover through retrying the same payload.
        permanent = [400, 401, 403, 404, 413, 422].includes(response.status);
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
      receipts[item.capture.captureId] = Date.now();
      health[station] = {
        ...h,
        lastSuccessAt: new Date().toISOString(),
        lastObservedAt:
          h.lastObservedAt &&
          Date.parse(h.lastObservedAt) > Date.parse(item.capture.observedAt)
            ? h.lastObservedAt
            : item.capture.observedAt,
        error: null,
        lastRoundTripMs: Date.now() - requestStarted,
        observedToAckMs: Date.now() - Date.parse(item.capture.observedAt),
      };
    } catch (e) {
      outcome = "retry";
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
        outcome = "rejected";
      }
    }
    await chrome.storage.local.set({
      outbox,
      health,
      deadLetters: deadLetters.slice(-20),
      receipts: Object.fromEntries(
        Object.entries(receipts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 1000),
      ),
    });
    return outcome;
  });
}
let draining = null;
function drain() {
  if (draining) return draining;
  draining = (async () => {
    const deadline = Date.now() + 20000;
    for (let n = 0; n < 40 && Date.now() < deadline; n++) {
      const outcome = await deliver();
      if (!outcome || outcome === "retry") break;
    }
  })().finally(() => {
    draining = null;
  });
  return draining;
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const fromOptions =
    sender.id === chrome.runtime.id &&
    sender.url === chrome.runtime.getURL("options.html");
  if (message.type === "configure" && fromOptions) {
    serial(async () => {
      const candidate = message.config || {};
      const origin = CortexQueue.endpoint(candidate.origin);
      if (typeof candidate.key !== "string" ||
          candidate.key.length < 16 || candidate.key.length > 512)
        throw new Error("Enter a development key of 16–512 characters");
      if (!Array.isArray(candidate.stations) || candidate.stations.length > 3)
        throw new Error("Invalid station list");
      const stations = candidate.stations.map((s) => ({
        code: s.code,
        serviceAreaId: typeof s.serviceAreaId === "string" ? s.serviceAreaId.trim() : "",
      }));
      if (stations.some((s) =>
          !stationCodes.includes(s.code) || !s.serviceAreaId ||
          s.serviceAreaId.length > 150) ||
          new Set(stations.map((s) => s.code)).size !== stations.length ||
          new Set(stations.map((s) => s.serviceAreaId)).size !== stations.length)
        throw new Error("Invalid station mapping");
      const { config, outbox = [], deadLetters = [], jobs = {} } =
        await chrome.storage.local.get(["config", "outbox", "deadLetters", "jobs"]);
      if (config && (config.origin !== origin || config.key !== candidate.key) &&
          (outbox.length || deadLetters.length || Object.keys(jobs).length))
        throw new Error("Finish pending captures before changing environment");
      const enabled = candidate.enabled === true;
      if (!enabled)
        for (const id of Object.keys(jobs))
          await chrome.tabs.remove(Number(id)).catch(() => {});
      await chrome.storage.local.set({
        config: { origin, key: candidate.key, enabled, stations },
        ...(!enabled ? { jobs: {} } : {}),
        ...(config && config.origin !== origin ? { receipts: {}, health: {}, lastScheduled: {} } : {}),
      });
    }).then(() => respond({ ok: true }))
      .catch((e) => respond({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === "collect-now" && sender.id === chrome.runtime.id &&
      (fromOptions || (!sender.url && !sender.tab))) {
    // Return the actual launch result, not a premature accepted flag. Never
    // allow an Amazon page's content script to issue manual collection commands.
    collect({ force: true, station: "DFO2" })
      .then(result => respond(result || { ok: false, error: "Collection unavailable" }))
      .catch(() => respond({ ok: false, error: "Could not open a collection tab" }));
    return true;
  }
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
        const {
          config,
          outbox = [],
          receipts = {},
        } = await chrome.storage.local.get(["config", "outbox", "receipts"]);
        if (!config?.enabled) throw new Error("Collection disabled");
        const serviceAreaId = message.payload?.serviceAreaId;
        if (typeof serviceAreaId !== "string" || !serviceAreaId ||
            serviceAreaId.length > 150)
          throw new Error("Missing Amazon service area identifier");
        let station = config.stations.find((s) => s.serviceAreaId === serviceAreaId);
        if (!station) {
          // Ask the local SYMX server, rather than inferring a station from route codes.
          const origin = CortexQueue.endpoint(config.origin);
          const lookup = await fetch(
            `${origin}/api/public/symx-cortex?serviceAreaId=${encodeURIComponent(serviceAreaId)}`,
            { headers: { "x-extension-key": config.key },
              signal: AbortSignal.timeout(10000), redirect: "error" },
          );
          if (!lookup.ok) {
            const health = (await chrome.storage.local.get("health")).health || {};
            health.unknown = {
              error: `Unrecognized service area ${serviceAreaId}; local station mapping required`,
              lastAttemptAt: new Date().toISOString(),
            };
            await chrome.storage.local.set({ health });
            throw new Error("Unknown station mapping");
          }
          const match = await lookup.json();
          if (!stationCodes.includes(match.code) || match.serviceAreaId !== serviceAreaId ||
              config.stations.some((s) => s.code === match.code &&
                s.serviceAreaId !== serviceAreaId))
            throw new Error("Conflicting station mapping");
          station = { code: match.code, serviceAreaId };
          config.stations.push(station);
          await chrome.storage.local.set({ config });
        }
        const p = message.payload;
        if (!["overview", "detail"].includes(p.kind))
          throw new Error("Unsupported capture");
        const routes = CortexAdapter.normalize(p.data, p.kind, p.observedAt);
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
        if (receipts[capture.captureId]) return capture.captureId;
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
      await deliver(captureId);
      const { receipts = {} } = await chrome.storage.local.get(["receipts"]);
      const ok = !!receipts[captureId];
      respond({ ok, queued: !ok });
    })().catch(() => respond({ ok: false }));
    return true;
  }
  if (["progress", "done"].includes(message.type)) {
    serial(async () => {
      const { jobs = {}, health = {} } = await chrome.storage.local.get([
        "jobs",
        "health",
      ]);
      const job = jobs[sender.tab.id];
      if (job) {
        const input = message.coverage || {};
        const coverage = Object.fromEntries(["expected", "acknowledged", "timedOut", "skipped", "durationMs"].map(key =>
          [key, Number.isSafeInteger(input[key]) && input[key] >= 0 ? Math.min(input[key], key === "durationMs" ? 600000 : 500) : 0]));
        coverage.overviewAcknowledged = input.overviewAcknowledged === true;
        const complete = message.ok === true && coverage.overviewAcknowledged && coverage.expected > 0 && coverage.acknowledged === coverage.expected;
        // Only fixed reasons and numeric coverage enter diagnostics, never page text or IDs.
        const reasons = {
          no_overview: "No overview: sign in or review response compatibility",
          no_targets: "Overview found no itinerary targets",
          access: "Amazon denied or throttled collection; use the authorized session later",
          stalled: "Stopped after three consecutive detail timeouts",
          finished: "Collection finished",
        };
        health[job.code] = {
          ...health[job.code], coverage,
          captureStatus: message.type === "progress" ? "collecting" : complete ? "complete" : "partial",
          captureDetail: Object.hasOwn(reasons, message.reason) ? reasons[message.reason] : "Collecting itinerary details",
          lastCollectionAt: new Date().toISOString(),
        };
        if (message.type === "done") delete jobs[sender.tab.id];
        await chrome.storage.local.set({ jobs, health });
        if (message.type === "done") await chrome.tabs.remove(sender.tab.id).catch(() => {});
      }
    }).then(() => respond({ ok: true })).catch(() => respond({ ok: false }));
    return true;
  }
});
async function collect({ force = false, station = null } = {}) {
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
    if (force && (!config?.enabled || !config.stations?.some((s) => s.code === station)))
      return { ok: false, error: "Enable collection and identify DFO2 first" };
    if (config?.enabled) {
      const hour = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Los_Angeles",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date()),
      );
      if (force || (hour >= 7 && hour < 24))
        for (const st of [...(config.stations || [])].sort((a, b) => stationCodes.indexOf(a.code) - stationCodes.indexOf(b.code))) {
          if (station && st.code !== station) continue;
          if (
            !stationCodes.includes(st.code) ||
            !st.serviceAreaId ||
            Object.values(jobs).some((j) => j.code === st.code) ||
            (!force && Date.now() - (lastScheduled[st.code] || 0) < 5 * 60000)
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
            active: force,
          });
          jobs[tab.id] = { code: st.code, started: Date.now() };
          health[st.code] = { ...health[st.code], captureStatus: "collecting",
            captureDetail: "Waiting for authorized overview", coverage: null };
          lastScheduled[st.code] = Date.now();
          await chrome.storage.local.set({ jobs, health, lastScheduled });
          return { ok: true, station: st.code };
        }
    }
    await chrome.storage.local.set({ jobs, health, lastScheduled });
    return force
      ? { ok: false, error: Object.values(jobs).some((j) => j.code === station)
          ? "A DFO2 collection is already running; check its status shortly"
          : "DFO2 unavailable; check station detection and collection settings" }
      : undefined;
  });
}
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "cortex-delivery") drain().catch(() => {});
  if (alarm.name === "cortex-collection") collect().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  collect().catch(() => {});
  drain().catch(() => {});
});
