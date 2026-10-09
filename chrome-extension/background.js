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
      const url = `https://logistics.amazon.com/operations/execution/itineraries/${encodeURIComponent(id)}/documentType/Itinerary?provider=ALL_DRIVERS&selectedDay=${encodeURIComponent(date)}&serviceAreaId=${encodeURIComponent(serviceAreaId)}`;
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
