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
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "symx-tick") return;
  const { schedEnabled, schedDone = {} } = await chrome.storage.local.get(["schedEnabled", "schedDone"]);
  if (!schedEnabled) return;
  const { date, hm } = pacificNow();
  if (!SCHEDULE_TIMES.includes(hm)) return;
  const key = `${date}|${hm}`;
  if (schedDone[key]) return;
  schedDone[key] = true;
  // keep only today's keys
  Object.keys(schedDone).forEach((k) => { if (!k.startsWith(date)) delete schedDone[k]; });
  await chrome.storage.local.set({ schedDone });
  if (hm === CDF_TIME) runCdfScheduled();
  else runScheduled(hm === SCHEDULE_TIMES[SCHEDULE_TIMES.length - 1], hm);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RUN_DONE" && runWaiter && sender.tab && sender.tab.id === runWaiter.tabId) {
    runWaiter.resolve(message.note || "ok");
  }
  if (message.type === "SYNC_CDF" && cdfWaiter && sender.tab && sender.tab.id === cdfWaiter.tabId) {
    setTimeout(() => cdfWaiter && cdfWaiter.resolve("ok"), 1500); // let the sync response land first
  }
  if (message.type === "CDF_NOW") {
    runCdfScheduled();
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
  try {
    const cfg = await fetch(`${SYMX_API_BASE}/api/public/extension-config`, { headers: { "x-extension-key": SYMX_API_KEY } }).then((r) => r.json());
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
  if (cdfRunning || running) return;
  cdfRunning = true;
  const log = [];
  try {
    const { date } = pacificNow();
    const y = new Date(date + "T12:00:00Z"); y.setUTCDate(y.getUTCDate() - 1);
    const to = y.toISOString().slice(0, 10);
    const cfg = await fetch(`${SYMX_API_BASE}/api/public/extension-config`, { headers: { "x-extension-key": SYMX_API_KEY } }).then((r) => r.json());
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
    }
  } catch (e) { log.push("failed: " + e.message); }
  await chrome.storage.local.set({ lastCdfRun: { at: new Date().toISOString(), log } });
  cdfRunning = false;
}
