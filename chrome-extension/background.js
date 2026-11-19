// ══════════════════════════════════════════════════════════════
// SYMX Route Scraper — Background Service Worker
// ══════════════════════════════════════════════════════════════

const SYMX_API_BASE = "https://symx-systems.vercel.app";
const SYMX_API_KEY = "symx-ext-route-sync-2026";

const AUTO_MIN_GAP_MS = 90 * 1000;
const autoLastSync = {};

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ROUTES_SCRAPED") {
    // Store scraped data temporarily
    chrome.storage.local.set({ 
      scrapedRoutes: message.data,
      scrapedAt: new Date().toISOString(),
      scrapedDate: message.selectedDate,
      scrapedServiceArea: message.serviceAreaId,
    });

    // Notify popup if open (ignore error if popup is closed)
    chrome.runtime.sendMessage({ type: "SCRAPE_COMPLETE", data: message.data }).catch(() => {});

    // Automatic mode: push to SYMX without anyone pressing Sync. Throttled
    // per date + station so Amazon's chatty refreshes don't hammer the API.
    if (message.auto && Array.isArray(message.data) && message.data.length && message.selectedDate) {
      const key = `${message.selectedDate}|${message.serviceAreaId || ""}`;
      const now = Date.now();
      if (!autoLastSync[key] || now - autoLastSync[key] > AUTO_MIN_GAP_MS) {
        autoLastSync[key] = now;
        syncToSYMX(message.data, message.selectedDate)
          .then(() => chrome.storage.local.set({ lastSync: new Date().toISOString() }))
          .catch((err) => {
            delete autoLastSync[key]; // allow a retry on the next capture
            console.warn("[SYMX] Auto-sync failed:", err.message);
          });
      }
    }
    sendResponse({ ok: true });
  }

  if (message.type === "SYNC_TO_SYMX") {
    syncToSYMX(message.data, message.date)
      .then(result => sendResponse({ ok: true, result }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.type === "GET_SCRAPED_DATA") {
    chrome.storage.local.get(["scrapedRoutes", "scrapedAt", "scrapedDate", "scrapedServiceArea"], (result) => {
      sendResponse(result);
    });
    return true;
  }

  if (message.type === "GET_STATIONS") {
    fetch(`${SYMX_API_BASE}/api/public/extension-config`, { headers: { "x-extension-key": SYMX_API_KEY } })
      .then((r) => r.json())
      .then((j) => sendResponse(j))
      .catch((e) => sendResponse({ stations: [], error: e.message }));
    return true;
  }
  if (message.type === "SYNC_CDF") {
    fetch(`${SYMX_API_BASE}/api/public/cdf-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-extension-key": SYMX_API_KEY },
      body: JSON.stringify(message.data),
    })
      .then((r) => r.json())
      .then((j) => { chrome.storage.local.set({ lastCdf: { at: new Date().toISOString(), result: j } }); sendResponse(j); })
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === "VISIT_START" && sender.tab) {
    runVisit(sender.tab.id, message.ids || [], message.date, message.serviceAreaId);
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === "VISIT_CANCEL") {
    if (visit) visit.cancel = true;
    if (visit && visit.resolve) visit.resolve();
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === "SYNC_ITINERARY_TO_SYMX") {
    const isVisitTab = visit && sender.tab && sender.tab.id === visit.tabId;
    const d = message.data || {};
    const hasStops = (Array.isArray(d.stops) && d.stops.length) ||
      (d.itineraryDetails && Array.isArray(d.itineraryDetails.stops) && d.itineraryDetails.stops.length);
    syncItineraryToSYMX(message.data)
      .then((result) => {
        sendResponse({ ok: true, ...result });
        if (isVisitTab && hasStops && visit.resolve) visit.resolve();
      })
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

// Sync scraped routes to SYMX Systems
async function syncToSYMX(routes, date) {
  const response = await fetch(`${SYMX_API_BASE}/api/public/extension-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-extension-key": SYMX_API_KEY,
    },
    body: JSON.stringify({ routes, date }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Sync failed");
  }

  return response.json();
}

// Sync a scraped Cortex itinerary to SYMX Systems (Efficiency screen auto-fill)
async function syncItineraryToSYMX(payload) {
  const response = await fetch(`${SYMX_API_BASE}/api/public/cortex-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-extension-key": SYMX_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error || "Cortex sync failed");
  }
  return json;
}


// ── Auto-visit: open each driver's itinerary page in a background tab so
// Cortex's own page loads (and signs) the request; content.js captures + syncs.
let visit = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function notifyVisit(originTabId, extra) {
  if (!visit && !extra) return;
  const msg = Object.assign(
    { type: "VISIT_PROGRESS", running: !!visit, done: visit ? visit.done : 0, total: visit ? visit.total : 0 },
    extra || {}
  );
  chrome.tabs.sendMessage(originTabId, msg).catch(() => {});
}

async function runVisit(originTabId, ids, date, serviceAreaId) {
  if (visit || !ids.length || !date || !serviceAreaId) return;
  visit = { tabId: null, resolve: null, cancel: false, done: 0, total: ids.length };
  try {
    const tab = await chrome.tabs.create({ url: "about:blank", active: false });
    visit.tabId = tab.id;
    for (const id of ids) {
      if (visit.cancel) break;
      notifyVisit(originTabId);
      const url = `https://logistics.amazon.com/operations/execution/itineraries/${encodeURIComponent(id)}/documentType/Itinerary?provider=ALL_DRIVERS&selectedDay=${encodeURIComponent(date)}&serviceAreaId=${encodeURIComponent(serviceAreaId)}&symx_visit=1`;
      await chrome.tabs.update(tab.id, { url });
      await new Promise((res) => { visit.resolve = res; setTimeout(res, 25000); });
      visit.resolve = null;
      visit.done++;
      await sleep(400);
    }
    chrome.tabs.remove(tab.id).catch(() => {});
  } catch (e) {
    console.warn("[SYMX visit]", e);
  }
  const done = visit ? visit.done : 0, total = visit ? visit.total : 0;
  visit = null;
  chrome.tabs.sendMessage(originTabId, { type: "VISIT_PROGRESS", running: false, done, total, finished: true }).catch(() => {});
}


// ══════════════════════════════════════════════════════════════
// Scheduled runs
// At fixed station times, open each station's Cortex page (signed-in Chrome
// required), capture every driver, close it, then ask SYMX to post any new
// issues to that station's Slack channel. Meant for an always-on computer.
// ══════════════════════════════════════════════════════════════
const PAY_TIMES = ["07:15", "16:30"]; // daily invoice sync (Pacific)
const CDF_TIME = "08:45"; // daily Customer Delivery Feedback pull (data trails ~1 day)
const SCHEDULE_TIMES = ["08:45", "12:30", "15:00", "18:00", "22:00", "22:30", "23:00"]; // Pacific; 22:00+ also checks returns/logouts; last = end of day
const RUN_TIMEOUT_MS = 8 * 60 * 1000;
let runWaiter = null;

function pacificNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hm: `${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}` };
}

chrome.alarms.create("symx-tick", { periodInMinutes: 1 });

// A run that was interrupted (computer slept, Chrome restarted, the service
// worker was stopped) leaves "running" stuck in storage, which the popup then
// shows forever. Anything marked running for over 20 minutes is cleared.
async function clearStaleRunState() {
  const keys = ["lastRun", "lastCdfRun", "lastPayRun", "lastBackfill"];
  const got = await chrome.storage.local.get(keys);
  const patch = {};
  for (const k of keys) {
    const r = got[k];
    if (r && r.running && Date.now() - new Date(r.at).getTime() > 20 * 60 * 1000) {
      patch[k] = Object.assign({}, r, { running: false, log: [...(r.log || []), "interrupted (computer asleep or Chrome restarted)"] });
    }
  }
  if (Object.keys(patch).length) await chrome.storage.local.set(patch);
}
clearStaleRunState();
chrome.runtime.onStartup.addListener(clearStaleRunState);
chrome.runtime.onInstalled.addListener(clearStaleRunState);

const toMin = (hm) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
const CATCH_UP_MIN = 25; // still run a slot this late if the computer was asleep at the exact minute

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "symx-tick") return;
  const { schedEnabled, schedDone = {} } = await chrome.storage.local.get(["schedEnabled", "schedDone"]);
  if (!schedEnabled) return;
  // Wait while something else is running; the slot stays due for the catch-up window.
  if (running || cdfRunning || payRunning || backfillRunning) return;
  const { date, hm } = pacificNow();

  // Newest slot that is due now (on time, or up to CATCH_UP_MIN late) and not yet run today.
  const now = toMin(hm);
  const due = [...SCHEDULE_TIMES, ...PAY_TIMES]
    .map((t) => ({ t, late: now - toMin(t) }))
    .filter((x) => x.late >= 0 && x.late <= CATCH_UP_MIN && !schedDone[`${date}|${x.t}`])
    .sort((a, b) => a.late - b.late)[0];
  if (!due) return;
  const slotHm = due.t;

  schedDone[`${date}|${slotHm}`] = true;
  // keep only today's keys
  Object.keys(schedDone).forEach((k) => { if (!k.startsWith(date)) delete schedDone[k]; });
  await chrome.storage.local.set({ schedDone });
  if (slotHm === CDF_TIME) runCdfScheduled();
  else if (PAY_TIMES.includes(slotHm)) runPaymentsScheduled();
  else runScheduled(slotHm === SCHEDULE_TIMES[SCHEDULE_TIMES.length - 1], slotHm);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RUN_DONE" && runWaiter && sender.tab && sender.tab.id === runWaiter.tabId) {
    runWaiter.resolve(message.note || "ok");
  }
  if (message.type === "SYNC_CDF" && cdfWaiter && sender.tab && sender.tab.id === cdfWaiter.tabId) {
    setTimeout(() => cdfWaiter && cdfWaiter.resolve("ok"), 1500); // let the sync response land first
  }
  if (message.type === "PAY_SYNC") {
    fetch(`${SYMX_API_BASE}/api/public/payments-sync`, { method: "POST", headers: { "Content-Type": "application/json", "x-extension-key": SYMX_API_KEY }, body: JSON.stringify(message.data) })
      .then((r) => r.json()).then((j) => { payStats.saved += j.saved || 0; payStats.audited += j.audited || 0; if (j.error) payStats.err = j.error; }).catch((e) => { payStats.err = e.message; });
  }
  if (message.type === "PAY_DONE" && payWaiter && sender.tab && sender.tab.id === payWaiter.tabId) {
    setTimeout(() => payWaiter && payWaiter.resolve((message.data && message.data.note) || "ok"), 2500); // let syncs land
  }
  if (message.type === "PAY_NOW") {
    runPaymentsScheduled();
    sendResponse({ ok: true });
  }
  if (message.type === "CDF_NOW") {
    runCdfScheduled();
    sendResponse({ ok: true });
  }
  if (message.type === "BACKFILL_START") {
    runBackfill(message.code, message.serviceAreaId, message.from, message.to);
    sendResponse({ ok: true });
  }
  if (message.type === "BACKFILL_CANCEL") {
    backfillCancel = true;
    if (runWaiter) runWaiter.resolve("cancelled");
    sendResponse({ ok: true });
  }
  if (message.type === "RUN_NOW") {
    runScheduled(!!message.final, pacificNow().hm);
    sendResponse({ ok: true });
  }
});

let running = false;
async function runScheduled(final, slot) {
  if (running) return;
  running = true;
  const { date } = pacificNow();
  const log = [];
  await chrome.storage.local.set({ lastRun: { at: new Date().toISOString(), log: ["starting…"], running: true } });
  try {
    const cfgRes = await fetch(`${SYMX_API_BASE}/api/public/extension-config`, { headers: { "x-extension-key": SYMX_API_KEY } });
    const cfg = await cfgRes.json().catch(() => ({}));
    if (!cfgRes.ok || !Array.isArray(cfg.stations)) log.push(`config failed (HTTP ${cfgRes.status}) — is the latest version deployed?`);
    else if (cfg.stations.length === 0) log.push("no active stations returned");
    for (const st of cfg.stations || []) {
      if (!st.serviceAreaId) { log.push(`${st.code}: skipped (no Amazon service area)`); continue; }
      let note = "timeout";
      let win = null;
      try {
        const url = `https://logistics.amazon.com/operations/execution/itineraries?provider=ALL_DRIVERS&selectedDay=${date}&serviceAreaId=${encodeURIComponent(st.serviceAreaId)}&symx_run=1`;
        win = await chrome.windows.create({ url, type: "normal", focused: false, width: 1280, height: 800 });
        const tabId = win.tabs && win.tabs[0] && win.tabs[0].id;
        note = await new Promise((resolve) => {
          runWaiter = { tabId, resolve };
          setTimeout(() => resolve("timeout"), RUN_TIMEOUT_MS);
        });
      } catch (e) { note = "error: " + e.message; }
      runWaiter = null;
      if (win) chrome.windows.remove(win.id).catch(() => {});
      let alerts = "";
      try {
        const r = await fetch(`${SYMX_API_BASE}/api/public/cortex-alerts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-extension-key": SYMX_API_KEY },
          body: JSON.stringify({ serviceAreaId: st.serviceAreaId, date, final, slot }),
        }).then((x) => x.json());
        alerts = r.skipped ? "no Slack" : `${r.posted || 0} alerts`;
      } catch (e) { alerts = "alerts failed"; }
      // Per-station collection health survives service-worker restarts.
      // A successful HTTP alert request does not imply route collection succeeded.
      const collectedAt = new Date().toISOString();
      const ok = note === "ok";
      const { stationCollectionHealth = {} } = await chrome.storage.local.get("stationCollectionHealth");
      stationCollectionHealth[st.code] = {
        date, collectedAt, status: ok ? "ok" : "warning",
        detail: note, source: "cortex-scheduled-capture",
        lastSuccessfulAt: ok ? collectedAt : (stationCollectionHealth[st.code]?.lastSuccessfulAt || null),
      };
      await chrome.storage.local.set({ stationCollectionHealth });
      log.push(`${st.code}: ${note} · ${alerts}`);
    }
  } catch (e) {
    log.push("failed: " + e.message);
  }
  await chrome.storage.local.set({ lastRun: { at: new Date().toISOString(), final, log } });
  running = false;
}


// ── Daily CDF pull: open each station's Customer Delivery Feedback page for
// yesterday; content.js captures the page's own data request and syncs it.
let cdfWaiter = null;
let cdfRunning = false;
async function runCdfScheduled() {
  if (cdfRunning || running) {
    chrome.storage.local.set({ lastCdfRun: { at: new Date().toISOString(), log: [cdfRunning ? "already running" : "a capture run is in progress"], running: true } });
    return;
  }
  cdfRunning = true;
  const log = [];
  const status = (extra) => chrome.storage.local.set({ lastCdfRun: Object.assign({ at: new Date().toISOString(), log: log.slice(), running: true }, extra || {}) });
  await status();
  try {
    const { date } = pacificNow();
    const y = new Date(date + "T12:00:00Z"); y.setUTCDate(y.getUTCDate() - 1);
    const to = y.toISOString().slice(0, 10);
    const cfgRes = await fetch(`${SYMX_API_BASE}/api/public/extension-config`, { headers: { "x-extension-key": SYMX_API_KEY } });
    const cfg = await cfgRes.json().catch(() => ({}));
    if (!cfgRes.ok || !Array.isArray(cfg.stations)) log.push(`config failed (HTTP ${cfgRes.status}) — is the latest version deployed?`);
    else if (cfg.stations.length === 0) log.push("no active stations returned");
    await status();
    for (const st of cfg.stations || []) {
      let win = null, note = "timeout";
      try {
        const url = `https://logistics.amazon.com/performance?pageId=dsp_customer_delivery_feedback_negative&navMenuVariant=external&station=${encodeURIComponent(st.code)}&tabId=customer-delivery-feedback-daily-tab&timeFrame=Daily&to=${to}&symx_cdf=1`;
        win = await chrome.windows.create({ url, type: "normal", focused: false, width: 1280, height: 800 });
        const tabId = win.tabs && win.tabs[0] && win.tabs[0].id;
        note = await new Promise((resolve) => { cdfWaiter = { tabId, resolve }; setTimeout(() => resolve("timeout"), 120000); });
      } catch (e) { note = "error: " + e.message; }
      cdfWaiter = null;
      if (win) chrome.windows.remove(win.id).catch(() => {});
      log.push(`${st.code}: ${note}`);
      await status();
    }
  } catch (e) { log.push("failed: " + e.message); }
  await chrome.storage.local.set({ lastCdfRun: { at: new Date().toISOString(), log } });
  cdfRunning = false;
}


// ── Payments (invoices) — read-only sync of Amazon's payments portal ──
let payRunning = false, payWaiter = null, payStats = { saved: 0, audited: 0, err: "" };
async function runPaymentsScheduled() {
  if (payRunning || running || cdfRunning) return;
  payRunning = true; payStats = { saved: 0, audited: 0, err: "" };
  let note = "timeout", win = null;
  const set = (extra) => chrome.storage.local.set({ lastPayRun: Object.assign({ at: new Date().toISOString(), log: [note] }, extra) });
  await set({ running: true, log: ["started"] });
  try {
    win = await chrome.windows.create({ url: "https://logistics.amazon.com/flexpayments/simpson/flexpro/invoices?symx_pay=1", type: "normal", focused: false, width: 1280, height: 800 });
    const tabId = win.tabs && win.tabs[0] && win.tabs[0].id;
    note = await new Promise((resolve) => { payWaiter = { tabId, resolve }; setTimeout(() => resolve("timeout"), 180000); });
  } catch (e) { note = "error: " + e.message; }
  payWaiter = null;
  if (win) chrome.windows.remove(win.id).catch(() => {});
  await set({ log: [note, `saved ${payStats.saved}, audited ${payStats.audited}${payStats.err ? " · server error: " + payStats.err : ""}`], bad: !!payStats.err || /error|no invoice|timeout/.test(note) });
  payRunning = false;
}


// ── Backfill: capture ONE station for a range of PAST days ──
// Same capture as the scheduled run (route list + every driver's itinerary,
// synced to SYMX by content.js), pointed at an earlier date via the page's
// selectedDay. Runs newest → oldest, one day at a time, in a background
// window. Does not post Slack alerts. Needs Chrome signed in to Cortex.
let backfillRunning = false;
let backfillCancel = false;
async function runBackfill(code, serviceAreaId, from, to) {
  if (backfillRunning || running || cdfRunning || payRunning) {
    chrome.storage.local.set({ lastBackfill: { at: new Date().toISOString(), running: false, log: ["another capture is running — try again in a few minutes"] } });
    return;
  }
  if (!serviceAreaId || !/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "") || from > to) {
    chrome.storage.local.set({ lastBackfill: { at: new Date().toISOString(), running: false, log: ["invalid station or dates"] } });
    return;
  }
  backfillRunning = true; backfillCancel = false; running = true; // `running` blocks scheduled captures meanwhile
  const dates = [];
  for (let d = new Date(to + "T12:00:00Z"); d.toISOString().slice(0, 10) >= from; d.setUTCDate(d.getUTCDate() - 1)) dates.push(d.toISOString().slice(0, 10));
  const log = [];
  const save = (extra) => chrome.storage.local.set({ lastBackfill: Object.assign({ at: new Date().toISOString(), station: code, from, to, total: dates.length, done: log.length, running: true, log: log.slice() }, extra || {}) });
  await save();
  try {
    for (const date of dates) {
      if (backfillCancel) { log.push("cancelled"); break; }
      let note = "timeout", win = null;
      try {
        const url = `https://logistics.amazon.com/operations/execution/itineraries?provider=ALL_DRIVERS&selectedDay=${date}&serviceAreaId=${encodeURIComponent(serviceAreaId)}&symx_run=1`;
        win = await chrome.windows.create({ url, type: "normal", focused: false, width: 1280, height: 800 });
        const tabId = win.tabs && win.tabs[0] && win.tabs[0].id;
        note = await new Promise((resolve) => {
          runWaiter = { tabId, resolve };
          setTimeout(() => resolve("timeout"), RUN_TIMEOUT_MS);
        });
      } catch (e) { note = "error: " + e.message; }
      runWaiter = null;
      if (win) chrome.windows.remove(win.id).catch(() => {});
      log.push(`${date}: ${note}`);
      await save();
    }
  } catch (e) { log.push("failed: " + e.message); }
  await save({ running: false, done: log.length });
  backfillRunning = false; running = false;
}
