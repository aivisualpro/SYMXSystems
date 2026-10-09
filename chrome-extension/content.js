// ══════════════════════════════════════════════════════════════
// SYMX Route Scraper — Content Script (MAIN world) V.1.1.0
// Intercepts Amazon Logistics API responses to capture route data
// Captures the FULL raw JSON from route-summaries for SYMXRoutesInfo
// Also intercepts the Cortex per-driver itinerary API to auto-fill
// Efficiency screen fields (see cortex sync section below)
// Communicates with extension via window.postMessage bridge
// ══════════════════════════════════════════════════════════════

(function () {
  "use strict";

  // ── Intercept XHR to capture route-summaries API ──
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  const capturedRoutes = new Map();
  let lastCaptureTime = 0;
  let lastCapturedApiDate = "";    // date extracted from the API URL
  let lastCapturedServiceArea = ""; // serviceAreaId from API URL
  let lastSummariesUrl = "";        // for periodic automatic refetch

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._symxUrl = url;
    this._symxMethod = method;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        if (
          this._symxUrl &&
          typeof this._symxUrl === "string" &&
          this._symxUrl.includes("route-summaries")
        ) {
          // Extract date + serviceAreaId from the API URL itself
          extractApiParams(this._symxUrl);
          lastSummariesUrl = this._symxUrl;
          const data = JSON.parse(this.responseText);
          processRouteSummariesResponse(data);
        }
        if (
          this._symxUrl &&
          typeof this._symxUrl === "string" &&
          /\/execution\/api\/summaries\?/.test(this._symxUrl)
        ) {
          extractApiParams(this._symxUrl);
          processSlimSummaries(JSON.parse(this.responseText));
        }
        if (
          this._symxUrl &&
          typeof this._symxUrl === "string" &&
          this._symxUrl.includes("/execution/api/itineraries/")
        ) {
          const data = JSON.parse(this.responseText);
          processItineraryResponse(data, this._symxUrl);
        }
      } catch (e) {
        // Silently ignore parse errors
      }
    });
    return originalXHRSend.apply(this, args);
  };

  // ── Also intercept fetch API ──
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      if (url.includes("route-summaries")) {
        extractApiParams(url);
        lastSummariesUrl = url;
        const cloned = response.clone();
        const data = await cloned.json();
        processRouteSummariesResponse(data);
      }
      if (/\/execution\/api\/summaries\?/.test(url)) {
        extractApiParams(url);
        processSlimSummaries(await response.clone().json());
      }
      if (url.includes("/execution/api/itineraries/")) {
        const cloned = response.clone();
        const data = await cloned.json();
        processItineraryResponse(data, url);
      }
    } catch (e) {
      // Silently ignore
    }

    return response;
  };

  // ── Extract localDate & serviceAreaId from the API URL ──
  //
  // capturedRoutes never expires on its own — it's a module-level Map
  // that lives for as long as this content script stays injected, which
  // is the whole tab session. Amazon's app is a single-page app: switching
  // the station dropdown or the date picker does NOT reload the page, it
  // just fires a new route-summaries request. Without clearing the Map on
  // a genuine view change, routes captured for an earlier station or date
  // just pile up forever — a popup reporting "25 captured routes" on a
  // 6-route day is really showing today's routes plus leftovers from
  // whatever was viewed earlier in this same tab (often the station left
  // open from the last shift). Worse, Amazon reuses route codes across
  // stations ("CX111" exists at more than one), so a stale entry doesn't
  // even look obviously wrong sitting in the list.
  function extractApiParams(url) {
    try {
      const u = new URL(url, window.location.origin);
      const ld = u.searchParams.get("localDate");
      const sa = u.searchParams.get("serviceAreaId");

      const isNewView =
        (ld && lastCapturedApiDate && ld !== lastCapturedApiDate) ||
        (sa && lastCapturedServiceArea && sa !== lastCapturedServiceArea);
      if (isNewView) {
        capturedRoutes.clear();
        captureLog.clear();
        bulkItins.clear();
        bulkSentStamp.clear();
      }

      if (ld) lastCapturedApiDate = ld;
      if (sa) lastCapturedServiceArea = sa;
    } catch { /* ignore */ }
  }

  // ══════════════════════════════════════════════════════════════
  // Cortex itinerary sync (Efficiency screen auto-fill)
  // ══════════════════════════════════════════════════════════════
  let capturedItinerary = null; // { data, url, itineraryId, serviceAreaId }
  let cortexSyncInterval = null;
  const CORTEX_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  // ── Auto-sync + capture tracker ──
  // Cortex signs every request it makes, so the extension can't fetch other
  // drivers' itineraries on its own. Instead it watches the itineraries the
  // page loads as someone clicks through the driver list, syncs each one as
  // it appears, and keeps a checklist of which routes are captured and which
  // still need a click.
  const AUTO_KEY = "symx_auto_sync";
  const isAutoOn = () => localStorage.getItem(AUTO_KEY) !== "off";
  // itineraryId -> { at, status: "synced"|"no-route"|"failed", note, name, codes, stamp }
  const captureLog = new Map();
  let lastSentItineraryId = "";

  function stampOf(t) {
    return `${t.itineraryStatus || t.progressStatus || t.executionStatus || ""}|${t.lastDriverEventTime || ""}`;
  }

  // itineraryId -> { id, codes, name, stamp } for EVERY driver, from the
  // station-wide summaries response (no clicking needed).
  const bulkItins = new Map();
  const bulkSentStamp = new Map(); // itineraryId -> stamp already auto-synced

  // One entry per itinerary (a driver on two routes shares one itinerary).
  function buildChecklist() {
    let base = Array.from(bulkItins.values());
    if (base.length === 0) {
      const byIt = new Map();
      capturedRoutes.forEach((route, code) => {
        const t = (route.transporters || [])[0];
        if (!t || !t.itineraryId) return;
        const e = byIt.get(t.itineraryId) || { id: t.itineraryId, codes: [], stamp: stampOf(t), name: "" };
        e.codes.push(route.routeCode || code);
        byIt.set(t.itineraryId, e);
      });
      base = Array.from(byIt.values());
    }
    return base.map((e) => {
      const rec = captureLog.get(e.id);
      let state = "needed";
      if (rec) {
        if (rec.status === "failed") state = "failed";
        else if (rec.status === "no-route") state = "no-route";
        else if (!rec.full) state = "partial";
        else state = (rec.stamp && rec.stamp !== e.stamp) ? "stale" : "done";
      }
      return { ...e, state, name: (rec && rec.name) || e.name };
    }).sort((x, y) => x.codes[0].localeCompare(y.codes[0], undefined, { numeric: true }));
  }

  const STATE_UI = {
    done:    { dot: "#16a34a", label: "fully captured" },
    partial: { dot: "#3b82f6", label: "auto-synced · click for 1st stop" },
    stale:   { dot: "#f59e0b", label: "changed — click again" },
    needed:  { dot: "#dc2626", label: "waiting to sync" },
    "no-route": { dot: "#6b7280", label: "not on SYMX schedule" },
    failed:  { dot: "#dc2626", label: "sync failed" },
  };

  let panelOpen = true;
  function renderPanel() {
    if (!document.body) return;
    let panel = document.getElementById("symx-capture-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "symx-capture-panel";
      panel.style.cssText = "position:fixed;bottom:100px;right:20px;z-index:999998;width:250px;max-height:55vh;overflow:auto;background:#111827;color:#fff;font:12px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.4);";
      document.body.appendChild(panel);
    }
    const list = buildChecklist();
    if (list.length === 0) { panel.style.display = "none"; return; }
    panel.style.display = "block";
    const done = list.filter((x) => x.state === "done").length;
    const auto = list.filter((x) => x.state === "partial" || x.state === "done" || x.state === "stale").length;
    panel.textContent = "";
    const head = document.createElement("div");
    head.style.cssText = "padding:8px 12px;font-weight:700;cursor:pointer;display:flex;justify-content:space-between;position:sticky;top:0;background:#111827;";
    head.textContent = `SYMX: ${auto}/${list.length} synced · ${done} full`;
    const caret = document.createElement("span");
    caret.textContent = panelOpen ? "▾" : "▸";
    head.appendChild(caret);
    head.addEventListener("click", () => { panelOpen = !panelOpen; renderPanel(); });
    panel.appendChild(head);
    if (!panelOpen) return;
    list.forEach((x) => {
      const ui = STATE_UI[x.state];
      const row = document.createElement("div");
      row.style.cssText = "padding:5px 12px;display:flex;align-items:center;gap:8px;border-top:1px solid rgba(255,255,255,.08);";
      const dot = document.createElement("span");
      dot.style.cssText = `width:9px;height:9px;border-radius:50%;flex:none;background:${ui.dot};`;
      const txt = document.createElement("span");
      txt.textContent = `${x.codes.join(", ")}${x.name ? " · " + x.name : ""}`;
      txt.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
      const st = document.createElement("span");
      const rec2 = captureLog.get(x.id);
      st.textContent = (x.state === "done" && rec2 && rec2.note) ? rec2.note : (x.state === "failed" || x.state === "no-route") && rec2 && rec2.note ? rec2.note.slice(0, 40) : ui.label;
      st.style.cssText = "opacity:.65;font-size:10px;";
      row.appendChild(dot); row.appendChild(txt); row.appendChild(st);
      panel.appendChild(row);
    });
  }
  setInterval(renderPanel, 2000);

  function processItineraryResponse(data, url) {
    if (!data) return;
    try {
      const u = new URL(url, window.location.origin);
      const det = data.itineraryDetails || {};
      let itineraryId = u.searchParams.get("itineraryId") || det.itineraryId || "";
      const serviceAreaId = u.searchParams.get("serviceAreaId") || det.serviceAreaId || "";
      capturedItinerary = { data, url, itineraryId, serviceAreaId, capturedAt: Date.now() };
      showCortexSyncButton();

      // Remember it (with the stamp from the route list, so we can tell later
      // whether the driver's data has changed since) and sync right away.
      const tr = Array.isArray(data.transporters) && data.transporters[0];
      let stamp = (bulkItins.get(itineraryId) || {}).stamp || "";
      if (!stamp) {
        capturedRoutes.forEach((route) => {
          const t = (route.transporters || [])[0];
          if (t && t.itineraryId === itineraryId) stamp = stampOf(t);
        });
      }
      captureLog.set(itineraryId, {
        at: Date.now(), status: "synced", full: true, stamp,
        name: tr ? [tr.firstName, tr.lastName].filter(Boolean).join(" ") : "",
      });
      if (isAutoOn()) {
        lastSentItineraryId = itineraryId;
        setTimeout(sendCortexSync, 800);
      }
      renderPanel();
    } catch (e) {
      // Silently ignore
    }
  }

  // Business-day (Pacific time) date string, matching the server's convention.
  function businessDateString() {
    // Prefer the page's own selectedDay (e.g. ...?selectedDay=2026-10-07) so
    // viewing a past/future day syncs to that day, not "today".
    const sd = new URLSearchParams(window.location.search).get("selectedDay");
    if (sd && /^\d{4}-\d{2}-\d{2}$/.test(sd)) return sd;
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  }

  function extractItineraryPayload(raw) {
    // Confirmed real shape: { itineraryDetails: {...}, stops: [...], addresses, transporters, companies }
    if (raw && raw.itineraryDetails) {
      const nested = Array.isArray(raw.itineraryDetails.stops) ? raw.itineraryDetails.stops : [];
      return { itineraryDetails: raw.itineraryDetails, stops: Array.isArray(raw.stops) && raw.stops.length ? raw.stops : nested };
    }
    // Defensive fallback in case Amazon ever returns itineraryDetails unwrapped
    if (raw && raw.transporterId && raw.serviceAreaId) {
      return { itineraryDetails: raw, stops: [] };
    }
    return null;
  }

  function sendCortexSync() {
    if (!capturedItinerary) return;
    const payload = extractItineraryPayload(capturedItinerary.data);
    if (!payload) {
      console.warn("[SYMX Cortex Sync] Captured itinerary response didn't match the expected shape.");
      return;
    }
    window.postMessage(
      {
        source: "SYMX_CONTENT",
        type: "ITINERARY_SYNC_REQUEST",
        payload: {
          serviceAreaId: capturedItinerary.serviceAreaId || payload.itineraryDetails.serviceAreaId || "",
          date: lastCapturedApiDate || businessDateString(),
          itineraryDetails: payload.itineraryDetails,
          stops: payload.stops,
        },
      },
      "*"
    );
  }

  // Re-fetch the itinerary URL directly (ambient session cookies apply
  // automatically) rather than relying on the page re-requesting it.
  async function refetchAndSyncItinerary() {
    if (!capturedItinerary) return;
    try {
      const res = await originalFetch(capturedItinerary.url, { credentials: "include" });
      const data = await res.json();
      capturedItinerary = { ...capturedItinerary, data, capturedAt: Date.now() };
    } catch (e) {
      console.warn("[SYMX Cortex Sync] Periodic refetch failed, syncing last-known data.", e);
    }
    sendCortexSync();
  }

  function setCortexButtonState(state) {
    const btn = document.getElementById("symx-cortex-sync-btn");
    if (!btn) return;
    if (state === "syncing") {
      btn.textContent = "Auto-syncing to SYMX — click to stop";
      btn.style.background = "linear-gradient(135deg, #16a34a, #15803d)";
    } else {
      btn.textContent = "Sync to SYMX";
      btn.style.background = "linear-gradient(135deg, #2563eb, #1d4ed8)";
    }
  }

  let cortexButtonInjected = false;
  function showCortexSyncButton() {
    if (cortexButtonInjected) return;
    cortexButtonInjected = true;
    const btn = document.createElement("div");
    btn.id = "symx-cortex-sync-btn";
    btn.style.cssText = `
      position: fixed;
      bottom: 60px;
      right: 20px;
      z-index: 999999;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      font-weight: 700;
      padding: 8px 14px;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(37, 99, 235, 0.4);
      cursor: pointer;
      opacity: 0.9;
      transition: all 0.2s ease;
    `;
    btn.addEventListener("mouseover", () => { btn.style.opacity = "1"; btn.style.transform = "scale(1.05)"; });
    btn.addEventListener("mouseout", () => { btn.style.opacity = "0.9"; btn.style.transform = "scale(1)"; });
    setCortexButtonState("idle");

    btn.addEventListener("click", () => {
      if (cortexSyncInterval) {
        clearInterval(cortexSyncInterval);
        cortexSyncInterval = null;
        setCortexButtonState("idle");
        return;
      }
      sendCortexSync(); // sync immediately on click
      cortexSyncInterval = setInterval(refetchAndSyncItinerary, CORTEX_SYNC_INTERVAL_MS);
      setCortexButtonState("syncing");
    });

    // content.js now runs at document_start (to win the race against the
    // page's own initial itinerary fetch), so document.body may not exist
    // yet when a response is captured — retry like the badge does.
    function appendWhenReady() {
      if (document.body) {
        document.body.appendChild(btn);
      } else {
        setTimeout(appendWhenReady, 50);
      }
    }
    appendWhenReady();
  }

  // Stop the periodic refresh if the dispatcher navigates away from this itinerary
  window.addEventListener("beforeunload", () => {
    if (cortexSyncInterval) clearInterval(cortexSyncInterval);
  });

  // Show a brief result summary as the button's tooltip after each sync.
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== "SYMX_CONTENT") return;
    if (event.data.type !== "ITINERARY_SYNC_RESULT") return;

    {
      const res0 = event.data.payload || {};
      const rec = captureLog.get(res0.itineraryId || lastSentItineraryId);
      if (rec) {
        if (!res0.ok && !res0.skipped) { rec.status = "failed"; rec.note = res0.error || ""; }
        else if (res0.skipped) { rec.status = "no-route"; rec.note = res0.reason || ""; }
        else {
          rec.status = "synced";
          const u = (res0.updated || []).length, c = (res0.conflicts || []).length;
          rec.note = `${u} updated` + (c ? `, ${c} conflict${c === 1 ? "" : "s"}` : "");
        }
        console.log("[SYMX capture] sync result", rec.name || lastSentItineraryId, res0);
        renderPanel();
      }
    }

    const btn = document.getElementById("symx-cortex-sync-btn");
    if (!btn) return;
    const result = event.data.payload || {};
    if (!result.ok) {
      btn.title = `SYMX sync failed: ${result.error || "unknown error"}`;
    } else if (result.skipped) {
      btn.title = `SYMX: ${result.reason || "no matching route found"}`;
    } else {
      const updatedCount = (result.updated || []).length;
      const conflictCount = (result.conflicts || []).length;
      btn.title = `SYMX: updated ${updatedCount} field${updatedCount === 1 ? "" : "s"}` +
        (conflictCount ? `, ${conflictCount} conflict${conflictCount === 1 ? "" : "s"} to review` : "");
    }
  });

  // ── Station-wide itinerary summaries ──
  // /api/summaries carries an itinerary summary for EVERY driver: departure,
  // stems, sign-in/out, meal break, rescues and the last stop time. Sync them
  // all automatically whenever a driver's numbers change. Only the first-stop
  // fields need a driver's itinerary page to be opened.
  function bulkSyncItinerarySummaries(data) {
    const its = Array.isArray(data.itinerarySummaries) ? data.itinerarySummaries : [];
    if (its.length === 0) return;
    const names = new Map();
    (Array.isArray(data.transporters) ? data.transporters : []).forEach((t) => {
      names.set(t.transporterId, [t.firstName, t.lastName].filter(Boolean).join(" "));
    });
    const date = lastCapturedApiDate || businessDateString();
    let delay = 0;
    its.forEach((it) => {
      if (!it || !it.itineraryId) return;
      const stamp = stampOf(it);
      const codes = Array.isArray(it.routeCodes) && it.routeCodes.length ? it.routeCodes : [it.routeCode];
      bulkItins.set(it.itineraryId, { id: it.itineraryId, codes, name: names.get(it.transporterId) || "", stamp });
      if (!isAutoOn() || bulkSentStamp.get(it.itineraryId) === stamp) return;
      bulkSentStamp.set(it.itineraryId, stamp);
      delay += 300; // stagger so SYMX isn't hit with 17 at once
      setTimeout(() => {
        if (!captureLog.has(it.itineraryId)) {
          captureLog.set(it.itineraryId, { at: Date.now(), status: "synced", full: false, stamp, name: names.get(it.transporterId) || "" });
        } else {
          captureLog.get(it.itineraryId).stamp = captureLog.get(it.itineraryId).full ? captureLog.get(it.itineraryId).stamp : stamp;
        }
        window.postMessage({
          source: "SYMX_CONTENT",
          type: "ITINERARY_SYNC_REQUEST",
          payload: {
            serviceAreaId: it.serviceAreaId || lastCapturedServiceArea || "",
            date,
            itineraryDetails: it,
            stops: [],
          },
        }, "*");
      }, delay);
    });
    renderPanel();
  }

  // ── Slim summaries (/api/summaries) ──
  // Before a route departs, Cortex's route-summaries response carries zero
  // stop counts and no driver. This lighter endpoint, which the page polls
  // constantly, has the real planned totals and the assigned driver, so it
  // fills those gaps (and supplies the route itself when route-summaries
  // hasn't listed it yet). It never overwrites richer data already captured.
  function processSlimSummaries(data) {
    if (!data) return;
    const slim = Array.isArray(data.routeSummaries) ? data.routeSummaries : [];
    bulkSyncItinerarySummaries(data);
    if (slim.length === 0) return;
    let touched = false;
    slim.forEach((r) => {
      const code = r.routeCode || r.routeId;
      if (!code) return;
      const totalStops = (r.stopProgress && r.stopProgress.total) || r.totalStops || 0;
      const totalTasks = r.totalTasks || 0;
      const tid = r.transporterIdFromRms || r.transporterId || "";
      const base = capturedRoutes.get(code);
      if (!base) {
        capturedRoutes.set(code, {
          routeId: r.routeId, routeCode: r.routeCode, serviceAreaId: lastCapturedServiceArea,
          transporterIdFromRms: tid, serviceTypeName: r.serviceTypeName,
          routeDuration: r.routeDuration, plannedDepartureTime: r.plannedDepartureTime,
          routeStatus: r.status, progressStatus: r.executionStatus,
          routeDeliveryProgress: { totalStops, totalDeliveries: totalTasks },
        });
        touched = true;
        return;
      }
      const rdp = base.routeDeliveryProgress || {};
      if (!rdp.totalStops && totalStops) {
        base.routeDeliveryProgress = { ...rdp, totalStops, totalDeliveries: rdp.totalDeliveries || totalTasks };
        touched = true;
      }
      if (!base.transporterIdFromRms && tid) { base.transporterIdFromRms = tid; touched = true; }
      if (!base.routeDuration && r.routeDuration) { base.routeDuration = r.routeDuration; touched = true; }
    });
    if (touched) {
      lastCaptureTime = Date.now();
      clearTimeout(window._symxDebounce);
      window._symxDebounce = setTimeout(() => { sendCapturedRoutes(); }, 2000);
    }
  }

  // ── Process route summaries from Amazon API ──
  function processRouteSummariesResponse(data) {
    if (!data) return;

    // Amazon response: the array is under "rmsRouteSummaries" (primary) or "routeSummaries" (fallback)
    let routeSummaries = [];

    if (Array.isArray(data)) {
      routeSummaries = data;
    } else if (data.rmsRouteSummaries && Array.isArray(data.rmsRouteSummaries)) {
      routeSummaries = data.rmsRouteSummaries;
    } else if (data.routeSummaries && Array.isArray(data.routeSummaries)) {
      routeSummaries = data.routeSummaries;
    } else if (typeof data === "object") {
      // Search recursively for arrays containing route-like objects
      for (const key of Object.keys(data)) {
        const val = data[key];
        if (Array.isArray(val) && val.length > 0 && (val[0]?.routeCode || val[0]?.routeId)) {
          routeSummaries = val;
          break;
        }
      }
    }

    if (routeSummaries.length === 0) return;

    // Store each route by routeCode — keep the FULL raw object
    routeSummaries.forEach((route) => {
      if (route.routeCode || route.routeId) {
        capturedRoutes.set(route.routeCode || route.routeId, route);
      }
    });

    lastCaptureTime = Date.now();

    // Debounce: wait 2s for all API responses to come in
    clearTimeout(window._symxDebounce);
    window._symxDebounce = setTimeout(() => {
      sendCapturedRoutes();
    }, 2000);
  }

  // ── Scrape stop/delivery counts from the Amazon DOM ──
  function scrapeStatsFromDOM() {
    const domStats = new Map(); // routeCode → { stops, deliveries, driverName, duration, signOut, avgStopsPerHour }

    // Amazon Logistics route list: each route row contains the code + stats
    // The route rows show: "CX48" ... "190/190 stops" ... "328/328 deliveries"
    // Try to grab all visible text blocks that contain route codes

    // Strategy: get all text on page and parse route blocks
    const allRows = document.querySelectorAll(
      '[class*="route"], [class*="Route"], [data-testid*="route"]'
    );

    allRows.forEach(row => {
      const text = row.textContent || "";
      // Look for route code pattern (2 letters + 2-3 digits)
      const codeMatch = text.match(/\b([A-Z]{2}\d{2,3})\b/);
      if (!codeMatch) return;

      const code = codeMatch[1];

      // Extract stops: "190/190 stops" or "190 stops"
      const stopsMatch = text.match(/(\d+)\/?\d*\s*stops?/i);
      // Extract deliveries: "328/328 deliveries" or "328 deliveries"
      const delsMatch = text.match(/(\d+)\/?\d*\s*deliver/i);
      // Extract driver name (usually first text after route code, in a bold/name element)
      const avgMatch = text.match(/Avg:\s*(\d+)\s*stops?\/hour/i);

      if (stopsMatch || delsMatch) {
        domStats.set(code, {
          stops: stopsMatch ? parseInt(stopsMatch[1]) : 0,
          deliveries: delsMatch ? parseInt(delsMatch[1]) : 0,
          avgStopsPerHour: avgMatch ? parseInt(avgMatch[1]) : 0,
        });
      }
    });

    // Fallback: scan full body text for the "<CODE> ... N/N stops ... N/N deliveries" pattern
    if (domStats.size === 0) {
      const body = document.body?.innerText || "";
      // Match blocks like: "CX48\n...\n190/190 stops    328/328 deliveries"
      const routeBlocks = body.split(/(?=\b[A-Z]{2}\d{2,3}\b)/);
      routeBlocks.forEach(block => {
        const cm = block.match(/^([A-Z]{2}\d{2,3})\b/);
        if (!cm) return;
        const code = cm[1];
        const stp = block.match(/(\d+)\/\d+\s*stops?/i);
        const del = block.match(/(\d+)\/\d+\s*deliver/i);
        if (stp || del) {
          domStats.set(code, {
            stops: stp ? parseInt(stp[1]) : 0,
            deliveries: del ? parseInt(del[1]) : 0,
            avgStopsPerHour: 0,
          });
        }
      });
    }

    return domStats;
  }

  // ── Send captured routes to extension ──
  function sendCapturedRoutes() {
    if (capturedRoutes.size === 0) return;

    // Try to get date from multiple sources
    const urlParams = new URLSearchParams(window.location.search);
    const selectedDay =
      lastCapturedApiDate ||
      urlParams.get("localDate") ||
      urlParams.get("selectedDay") ||
      "";
    const serviceAreaId =
      lastCapturedServiceArea ||
      urlParams.get("serviceAreaId") ||
      "";

    // Scrape DOM for stops/deliveries to merge with API data
    const domStats = scrapeStatsFromDOM();
    console.log(`[SYMX Scraper] DOM stats scraped for ${domStats.size} routes`);

    const routes = [];
    capturedRoutes.forEach((route, code) => {
      const extracted = extractRouteData(route);

      // Merge DOM-scraped stats if API data has 0 values
      const ds = domStats.get(extracted.routeCode);
      if (ds) {
        if (!extracted.stopCount || extracted.stopCount === 0 || extracted.stopCount === "0") {
          extracted.stopCount = ds.stops;
        }
        if (!extracted.packageCount || extracted.packageCount === 0 || extracted.packageCount === "0") {
          extracted.packageCount = ds.deliveries;
        }
        if ((!extracted.stopsPerHour || extracted.stopsPerHour === 0) && ds.avgStopsPerHour) {
          extracted.stopsPerHour = ds.avgStopsPerHour;
        }
      }

      routes.push(extracted);
    });

    console.log(`[SYMX Scraper] Captured ${routes.length} routes for ${selectedDay}`);

    // Send via postMessage bridge to ISOLATED world injector
    window.postMessage(
      {
        source: "SYMX_CONTENT",
        type: "ROUTES_SCRAPED",
        payload: {
          routes,
          selectedDate: selectedDay,
          serviceAreaId: serviceAreaId,
          auto: isAutoOn(),
        },
      },
      "*"
    );

    // Store in window for easy access
    window._symxCapturedRoutes = routes;
    window._symxCapturedDate = selectedDay;

    renderPanel();
  }

  // ── Deep search: find a numeric value by searching all keys recursively ──
  function deepFind(obj, keys, maxDepth = 3) {
    if (!obj || typeof obj !== "object" || maxDepth <= 0) return undefined;
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    for (const val of Object.values(obj)) {
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        const found = deepFind(val, keys, maxDepth - 1);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  }

  // ── Extract route data into SYMX format ──
  // Uses the REAL Amazon rmsRouteSummaries structure
  function extractRouteData(route) {
    // The real counts are inside routeDeliveryProgress (top-level totalStops is always 0)
    const rdp = route.routeDeliveryProgress || {};

    // Stops: use routeDeliveryProgress.totalStops
    const stopVal = rdp.totalStops || rdp.completedStops || route.totalStops || 0;

    // Packages: use routeDeliveryProgress.totalDeliveries
    const pkgVal = rdp.totalDeliveries || rdp.completedDeliveries || route.totalTasks || 0;

    // Transporter ID: use transporterIdFromRms (top-level) or first transporter
    const transporterId = route.transporterIdFromRms
      || (route.transporters?.[0]?.transporterId)
      || route.transporterId
      || "";

    const r = {
      routeCode: route.routeCode || "",
      routeId: route.routeId || "",
      transporterId: transporterId,
      transporterName: route.transporterName || route.driverName || "",

      // Core route info from routeDeliveryProgress
      stopCount: stopVal,
      packageCount: pkgVal,
      routeDuration: route.routeDuration || route.duration || "",

      // Status
      status: route.routeStatus || route.progressStatus || route.status || "",
      progress: route.progress || route.completionPercentage || 0,
      stopsCompleted: rdp.completedStops || 0,

      // Time data
      departureTime: route.plannedDepartureTime || route.departureTime || "",
      firstStopTime: route.firstStopTime || route.firstDeliveryTime || "",
      lastStopTime: route.lastStopTime || route.lastDeliveryTime || "",
      plannedFirstStop: route.transporters?.[0]?.plannedBreaks?.[0]?.plannedStart || "",
      completionTime: route.completionTime || "",
      returnTime: route.returnTime || "",

      // Stems
      outboundStem: route.outboundStem || "",
      inboundStem: route.inboundStem || "",

      // Performance
      stopsPerHour: route.stopsPerHour || 0,

      // Route details
      routeSize: route.serviceTypeName || route.routeSize || "",
      waveTime: route.waveTime || route.plannedDepartureTime || "",

      // Delivery counts from routeDeliveryProgress
      deliveriesAttempted: rdp.completedDeliveries || 0,
      deliveriesCompleted: rdp.successfulDeliveries || 0,
      totalPickups: rdp.totalPickUps || 0,
      unassignedPackages: rdp.unassignedPackages || 0,

      // ★ Store the ENTIRE raw object for the detail view & DB
      _raw: route,
    };

    return r;
  }

  // ── DOM scrape fallback ──
  function scrapeFromDOM() {
    const routes = [];

    // Try route list items from Amazon Logistics page
    const routeItems = document.querySelectorAll(
      '[data-testid*="route"], [class*="route-card"], [class*="RouteCard"], [class*="route-item"]'
    );

    if (routeItems.length > 0) {
      routeItems.forEach((item) => {
        const codeEl = item.querySelector(
          '[class*="routeCode"], [class*="route-code"], [data-testid*="code"]'
        );
        const nameEl = item.querySelector(
          '[class*="driver"], [class*="transporter"]'
        );
        const stopsEl = item.querySelector('[class*="stop"]');
        const pkgsEl = item.querySelector('[class*="package"], [class*="deliver"]');

        const code = codeEl?.textContent?.trim() || "";
        if (code) {
          routes.push({
            routeCode: code,
            transporterName: nameEl?.textContent?.trim() || "",
            stopCount: parseInt(stopsEl?.textContent?.replace(/[^\d]/g, "") || "0") || 0,
            packageCount: parseInt(pkgsEl?.textContent?.replace(/[^\d]/g, "") || "0") || 0,
            _source: "dom_scrape",
          });
        }
      });
    }

    // Fallback: try the visible route list from the screenshot structure
    if (routes.length === 0) {
      const allText = document.body.innerText || "";
      // Match patterns like "CX50" followed by numbers
      const regex = /\b([A-Z]{2}\d{2,3})\b/g;
      const codes = new Set();
      let match;
      while ((match = regex.exec(allText)) !== null) {
        codes.add(match[1]);
      }
      codes.forEach((code) => {
        routes.push({ routeCode: code, _source: "text_scrape" });
      });
    }

    return routes;
  }

  // ── Listen for messages from injector (via postMessage bridge) ──
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== "SYMX_EXTENSION") return;

    const { type } = event.data;

    if (type === "SCRAPE_NOW") {
      sendCapturedRoutes();

      // No DOM/text-scrape fallback: route codes lifted off the page have no
      // stop counts or station and used to overwrite good data with zeros.
      // If nothing was intercepted, report 0 captured and let the user reload.

      window.postMessage(
        {
          source: "SYMX_CONTENT",
          type: "SCRAPE_NOW_RESPONSE",
          payload: {
            captured: capturedRoutes.size,
            lastCapture: lastCaptureTime,
          },
        },
        "*"
      );
    }

    if (type === "GET_PAGE_INFO") {
      const urlParams = new URLSearchParams(window.location.search);
      window.postMessage(
        {
          source: "SYMX_CONTENT",
          type: "GET_PAGE_INFO_RESPONSE",
          payload: {
            isAmazonLogistics: window.location.hostname === "logistics.amazon.com",
            selectedDay:
              lastCapturedApiDate ||
              urlParams.get("localDate") ||
              urlParams.get("selectedDay") ||
              "",
            serviceAreaId:
              lastCapturedServiceArea ||
              urlParams.get("serviceAreaId") ||
              "",
            provider: urlParams.get("provider") || "",
            capturedCount: capturedRoutes.size,
            lastCapture: lastCaptureTime,
            url: window.location.href,
          },
        },
        "*"
      );
    }
  });

  // ── Floating badge indicator ──
  const badge = document.createElement("div");
  badge.id = "symx-scraper-badge";
  badge.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      background: linear-gradient(135deg, #f97316, #ef4444);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      font-weight: 700;
      padding: 8px 14px;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(249, 115, 22, 0.4);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.3s ease;
      opacity: 0.85;
      backdrop-filter: blur(8px);
    "
    onmouseover="this.style.opacity='1'; this.style.transform='scale(1.05)'"
    onmouseout="this.style.opacity='0.85'; this.style.transform='scale(1)'"
    title="SYMX Route Scraper Active — Click to toggle"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <span>SYMX</span>
      <span id="symx-route-count" style="
        background: rgba(255,255,255,0.25);
        padding: 1px 6px;
        border-radius: 6px;
        font-size: 10px;
      ">0</span>
    </div>
  `;

  // Click the badge to switch automatic sync on/off (green = auto, grey = manual).
  function paintBadge() {
    const inner = badge.firstElementChild;
    if (!inner) return;
    inner.style.background = isAutoOn()
      ? "linear-gradient(135deg, #16a34a, #15803d)"
      : "linear-gradient(135deg, #6b7280, #4b5563)";
    inner.title = isAutoOn()
      ? "SYMX auto-sync ON — click to turn off"
      : "SYMX auto-sync OFF — click to turn on";
  }
  badge.addEventListener("click", () => {
    localStorage.setItem(AUTO_KEY, isAutoOn() ? "off" : "on");
    paintBadge();
  });
  paintBadge();

  // Wait for body to be available
  function injectBadge() {
    if (document.body) {
      document.body.appendChild(badge);
    } else {
      setTimeout(injectBadge, 100);
    }
  }
  injectBadge();

  // Update badge count
  setInterval(() => {
    const countEl = document.getElementById("symx-route-count");
    if (countEl) {
      countEl.textContent = capturedRoutes.size.toString();
    }
  }, 1000);

  console.log(
    "[SYMX Route Fetch] Content script loaded (MAIN world) v1.0.5 — intercepting route data..."
  );
})();
