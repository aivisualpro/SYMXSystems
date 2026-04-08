// ══════════════════════════════════════════════════════════════
// SYMX Route Scraper — Content Script (MAIN world) v1.1
// Intercepts Amazon Logistics API responses to capture route data
// Captures the FULL raw JSON from route-summaries for SYMXRoutesInfo
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
          const data = JSON.parse(this.responseText);
          processRouteSummariesResponse(data);
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
        const cloned = response.clone();
        const data = await cloned.json();
        processRouteSummariesResponse(data);
      }
    } catch (e) {
      // Silently ignore
    }

    return response;
  };

  // ── Extract localDate & serviceAreaId from the API URL ──
  function extractApiParams(url) {
    try {
      const u = new URL(url, window.location.origin);
      const ld = u.searchParams.get("localDate");
      const sa = u.searchParams.get("serviceAreaId");
      if (ld) lastCapturedApiDate = ld;
      if (sa) lastCapturedServiceArea = sa;
    } catch { /* ignore */ }
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
        },
      },
      "*"
    );

    // Store in window for easy access
    window._symxCapturedRoutes = routes;
    window._symxCapturedDate = selectedDay;
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

      // If no intercepted data, try DOM scrape
      if (capturedRoutes.size === 0) {
        const domRoutes = scrapeFromDOM();
        if (domRoutes.length > 0) {
          window.postMessage(
            {
              source: "SYMX_CONTENT",
              type: "ROUTES_SCRAPED",
              payload: {
                routes: domRoutes,
                selectedDate:
                  lastCapturedApiDate ||
                  new URLSearchParams(window.location.search).get("localDate") ||
                  new URLSearchParams(window.location.search).get("selectedDay") ||
                  "",
                serviceAreaId:
                  lastCapturedServiceArea ||
                  new URLSearchParams(window.location.search).get("serviceAreaId") ||
                  "",
              },
            },
            "*"
          );
        }
      }

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
    "[SYMX Route Fetch] Content script loaded (MAIN world) v1.0.2 — intercepting route data..."
  );
})();
