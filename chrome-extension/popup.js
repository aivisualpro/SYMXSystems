// ══════════════════════════════════════════════════════════════
// SYMX Route Scraper — Popup Controller v1.1
// ══════════════════════════════════════════════════════════════

const TARGETS = {
  production: "https://symx-systems.vercel.app",
  local: "http://localhost:3000",
};
const API_KEY = "symx-ext-route-sync-2026";

// DOM Elements
const statusDot = document.getElementById("statusDot");
const connectionCard = document.getElementById("connectionCard");
const connectionIcon = document.getElementById("connectionIcon");
const connectionLabel = document.getElementById("connectionLabel");
const connectionDetail = document.getElementById("connectionDetail");
const pageInfoSection = document.getElementById("pageInfoSection");
const dateValue = document.getElementById("dateValue");
const stationValue = document.getElementById("stationValue");
const routesSection = document.getElementById("routesSection");
const routeCountBadge = document.getElementById("routeCountBadge");
const routeList = document.getElementById("routeList");
const emptyState = document.getElementById("emptyState");
const actionsSection = document.getElementById("actionsSection");
const scrapeBtn = document.getElementById("scrapeBtn");
const syncBtn = document.getElementById("syncBtn");
const syncStatusSection = document.getElementById("syncStatusSection");
const syncResultSection = document.getElementById("syncResultSection");
const syncResult = document.getElementById("syncResult");
const targetSelect = document.getElementById("targetSelect");
const lastSyncTime = document.getElementById("lastSyncTime");

// Detail overlay elements
const detailOverlay = document.getElementById("detailOverlay");
const detailBack = document.getElementById("detailBack");
const detailRouteCode = document.getElementById("detailRouteCode");
const detailDriver = document.getElementById("detailDriver");
const detailStatusBadge = document.getElementById("detailStatusBadge");
const detailBody = document.getElementById("detailBody");

let currentRoutes = [];
let currentDate = "";

// ── Initialize ──
async function init() {
  // Restore settings
  chrome.storage.local.get(["target", "lastSync"], (result) => {
    if (result.target) targetSelect.value = result.target;
    if (result.lastSync) {
      const ago = getTimeAgo(new Date(result.lastSync));
      lastSyncTime.textContent = `Last sync: ${ago}`;
    }
  });

  // Check current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab?.url?.includes("logistics.amazon.com")) {
    showDisconnected("Navigate to Amazon Logistics", "Open logistics.amazon.com to start scraping routes");
    return;
  }

  // Get page info from content script
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_INFO" });
    
    if (response?.isAmazonLogistics) {
      showConnected(response);
      
      // Load any previously captured data
      if (response.capturedCount > 0) {
        loadCapturedData();
      } else {
        // Try to get from storage
        loadFromStorage();
      }
    } else {
      showDisconnected("Not on routes page", "Navigate to the DV Routes page on Amazon Logistics");
    }
  } catch (e) {
    // Content script not injected yet
    showWarning("Content script loading...", "Refresh the Amazon Logistics page");
    // Try storage anyway
    loadFromStorage();
  }

  // Set up detail tabs
  setupDetailTabs();
}

function showConnected(info) {
  statusDot.className = "status-dot connected";
  connectionCard.className = "connection-card connected";
  connectionLabel.textContent = "Connected to Amazon Logistics";
  connectionDetail.textContent = info.url ? new URL(info.url).pathname.split("/").slice(-1)[0] : "";
  connectionIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;

  // Show page info
  if (info.selectedDay) {
    pageInfoSection.style.display = "";
    const d = new Date(info.selectedDay + "T12:00:00Z");
    dateValue.textContent = d.toLocaleDateString("en-US", { 
      weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" 
    });
    currentDate = info.selectedDay;
  }
  
  if (info.serviceAreaId) {
    stationValue.textContent = info.serviceAreaId.substring(0, 8) + "...";
    stationValue.title = info.serviceAreaId;
  }

  routesSection.style.display = "";
  actionsSection.style.display = "";
}

function showDisconnected(label, detail) {
  statusDot.className = "status-dot disconnected";
  connectionCard.className = "connection-card error";
  connectionLabel.textContent = label;
  connectionDetail.textContent = detail;
  connectionIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
}

function showWarning(label, detail) {
  statusDot.className = "status-dot warning";
  connectionCard.className = "connection-card";
  connectionLabel.textContent = label;
  connectionDetail.textContent = detail;
  routesSection.style.display = "";
  actionsSection.style.display = "";
  loadFromStorage();
}

async function loadCapturedData() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const result = await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_NOW" });
    // Data will come back via storage
    setTimeout(loadFromStorage, 500);
  } catch {
    loadFromStorage();
  }
}

function loadFromStorage() {
  chrome.storage.local.get(["scrapedRoutes", "scrapedAt", "scrapedDate"], (result) => {
    if (result.scrapedRoutes?.length) {
      currentRoutes = result.scrapedRoutes;
      currentDate = result.scrapedDate || currentDate;
      renderRoutes(currentRoutes);
      syncBtn.disabled = false;

      if (result.scrapedDate) {
        pageInfoSection.style.display = "";
        const d = new Date(result.scrapedDate + "T12:00:00Z");
        dateValue.textContent = d.toLocaleDateString("en-US", { 
          weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" 
        });
      }
    }
  });
}

function renderRoutes(routes) {
  routeCountBadge.textContent = routes.length;
  
  if (routes.length === 0) {
    routeList.innerHTML = emptyState.outerHTML;
    return;
  }

  // Calculate totals
  const totalStops = routes.reduce((s, r) => s + (parseInt(r.stopCount) || 0), 0);
  const totalPkgs = routes.reduce((s, r) => s + (parseInt(r.packageCount) || 0), 0);

  let html = `
    <div class="summary-bar">
      <span class="sum-val">${routes.length}</span> routes
      <span class="sum-sep">·</span>
      <span class="sum-val">${totalStops.toLocaleString()}</span> stops
      <span class="sum-sep">·</span>
      <span class="sum-val">${totalPkgs.toLocaleString()}</span> pkgs
    </div>
  `;

  routes.forEach((route, idx) => {
    const stops = parseInt(route.stopCount) || 0;
    const pkgs = parseInt(route.packageCount) || 0;
    const statusClass = getStatusClass(route.status);
    const statusLabel = getStatusLabel(route.status);
    const hasRaw = route._raw && Object.keys(route._raw).length > 0;
    
    html += `
      <div class="route-item ${hasRaw ? 'has-detail' : ''}" data-route-idx="${idx}">
        <span class="route-code">${route.routeCode || "—"}</span>
        <span class="route-driver">${route.transporterName || route.transporterId || "—"}</span>
        <div class="route-stats">
          <div class="route-stat">
            <span class="stat-value">${stops}</span>
            <span>stp</span>
          </div>
          <div class="route-stat">
            <span class="stat-value">${pkgs}</span>
            <span>pkg</span>
          </div>
          ${statusLabel ? `<span class="route-status-badge ${statusClass}">${statusLabel}</span>` : ""}
          <button class="route-detail-btn" title="View Details" data-route-idx="${idx}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  });

  routeList.innerHTML = html;

  // Attach click handlers for detail buttons and route rows
  routeList.querySelectorAll(".route-detail-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.routeIdx);
      openRouteDetail(currentRoutes[idx], idx);
    });
  });

  routeList.querySelectorAll(".route-item").forEach(item => {
    item.addEventListener("click", () => {
      const idx = parseInt(item.dataset.routeIdx);
      openRouteDetail(currentRoutes[idx], idx);
    });
  });
}

// ══════════════════════════════════════════════════════════════
// DETAIL OVERLAY
// ══════════════════════════════════════════════════════════════

function openRouteDetail(route, idx) {
  if (!route) return;

  const raw = route._raw || route;
  
  // Set header
  detailRouteCode.textContent = route.routeCode || `Route #${idx + 1}`;
  detailDriver.textContent = route.transporterName || route.transporterId || "—";
  
  const statusLabel = getStatusLabel(route.status);
  const statusClass = getStatusClass(route.status);
  if (statusLabel) {
    detailStatusBadge.textContent = statusLabel;
    detailStatusBadge.className = `detail-status-badge ${statusClass}`;
    detailStatusBadge.style.display = "";
  } else {
    detailStatusBadge.style.display = "none";
  }

  // Populate Summary tab
  populateSummaryTab(route, raw);
  
  // Populate Transporters tab
  populateTransportersTab(raw);
  
  // Populate Raw JSON tab
  populateRawTab(raw);

  // Show overlay
  detailOverlay.classList.add("visible");
}

function closeRouteDetail() {
  detailOverlay.classList.remove("visible");
}

function populateSummaryTab(route, raw) {
  const tab = document.getElementById("tab-summary");
  
  // Build key/value pairs from the raw data
  const fields = [
    { label: "Route ID", value: raw.routeId },
    { label: "Route Code", value: raw.routeCode || route.routeCode },
    { label: "Service Area ID", value: raw.serviceAreaId },
    { label: "Total Stops", value: raw.totalStops ?? raw.numberOfStops ?? route.stopCount },
    { label: "Total Tasks", value: raw.totalTasks },
    { label: "Planned Stops", value: raw.plannedSequenceStops ?? raw.plannedStopCount },
    { label: "Letter/Archive", value: raw.letterArchive ?? raw.routeSize },
    { label: "Transporter ID", value: raw.transporterId ?? route.transporterId },
    { label: "Status", value: raw.status ?? raw.routeStatus ?? route.status },
    { label: "Progress %", value: raw.progress ?? raw.completionPercentage ?? route.progress },
    { label: "Stops Completed", value: raw.stopsCompleted ?? raw.completedStops ?? raw.deliveredStopCount },
    { label: "Packages Delivered", value: raw.deliveredPackageCount ?? raw.deliveriesCompleted ?? route.deliveriesCompleted },
    { label: "Route Duration", value: raw.routeDuration ?? raw.duration ?? route.routeDuration },
    { label: "Departure Time", value: raw.departureTime ?? raw.actualDepartureTime },
    { label: "First Stop", value: raw.firstStopTime ?? raw.actualFirstStop ?? raw.firstDeliveryTime },
    { label: "Last Stop", value: raw.lastStopTime ?? raw.actualLastStop ?? raw.lastDeliveryTime },
    { label: "Return Time", value: raw.returnTime ?? raw.returnToStationTime },
    { label: "Outbound Stem", value: raw.outboundStem ?? raw.outboundStemTime },
    { label: "Inbound Stem", value: raw.inboundStem ?? raw.inboundStemTime },
    { label: "Stops/Hour", value: raw.stopsPerHour },
    { label: "Wave Time", value: raw.waveTime ?? raw.departureWaveTime ?? raw.plannedDepartureTime },
    { label: "Deliveries Attempted", value: raw.deliveriesAttempted },
  ];

  // Add any other top-level keys from raw that aren't covered
  const coveredKeys = new Set([
    "routeId", "routeCode", "serviceAreaId", "totalStops", "numberOfStops",
    "totalTasks", "plannedSequenceStops", "plannedStopCount", "letterArchive",
    "routeSize", "transporterId", "status", "routeStatus", "progress",
    "completionPercentage", "stopsCompleted", "completedStops", "deliveredStopCount",
    "deliveredPackageCount", "deliveriesCompleted", "routeDuration", "duration",
    "departureTime", "actualDepartureTime", "firstStopTime", "actualFirstStop",
    "firstDeliveryTime", "lastStopTime", "actualLastStop", "lastDeliveryTime",
    "returnTime", "returnToStationTime", "outboundStem", "outboundStemTime",
    "inboundStem", "inboundStemTime", "stopsPerHour", "waveTime",
    "departureWaveTime", "plannedDepartureTime", "deliveriesAttempted",
    "transporters", "transporterName", "driverName", "stopCount",
    "packageCount", "numberOfPackages", "totalPackages", "plannedPackageCount",
    "executionStatus", "completionTime", "deliveryCompletionTime",
    "actualOutboundStem", "actualInboundStem"
  ]);

  if (typeof raw === "object" && raw !== null) {
    Object.keys(raw).forEach(key => {
      if (!coveredKeys.has(key) && typeof raw[key] !== "object") {
        fields.push({ label: camelToTitle(key), value: raw[key] });
      }
    });
  }

  let html = '<div class="detail-grid">';
  fields.forEach(f => {
    if (f.value === undefined || f.value === null || f.value === "") return;
    const displayVal = formatDetailValue(f.value);
    html += `
      <div class="detail-field">
        <span class="detail-field-label">${f.label}</span>
        <span class="detail-field-value">${displayVal}</span>
      </div>
    `;
  });
  html += '</div>';

  tab.innerHTML = html;
}

function populateTransportersTab(raw) {
  const tab = document.getElementById("tab-transporters");
  const transporters = raw.transporters || [];

  if (!transporters.length) {
    tab.innerHTML = `
      <div class="detail-empty">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span>No transporter data available</span>
      </div>
    `;
    return;
  }

  let html = "";
  transporters.forEach((t, i) => {
    html += `<div class="transporter-card">`;
    html += `<div class="transporter-header">`;
    html += `<span class="transporter-num">Transporter ${i + 1}</span>`;
    if (t.transporterId) html += `<span class="transporter-id">${t.transporterId}</span>`;
    html += `</div>`;

    // Transporter fields
    const tFields = [];
    if (typeof t === "object" && t !== null) {
      Object.keys(t).forEach(key => {
        if (key === "breaks" || key === "transporterId") return;
        const val = t[key];
        if (val === undefined || val === null || val === "") return;
        if (typeof val === "object" && !Array.isArray(val)) return;
        tFields.push({ label: camelToTitle(key), value: val });
      });
    }

    if (tFields.length > 0) {
      html += '<div class="detail-grid compact">';
      tFields.forEach(f => {
        html += `
          <div class="detail-field">
            <span class="detail-field-label">${f.label}</span>
            <span class="detail-field-value">${formatDetailValue(f.value)}</span>
          </div>
        `;
      });
      html += '</div>';
    }

    // Breaks
    const breaks = t.breaks || [];
    if (breaks.length > 0) {
      html += `<div class="breaks-section">`;
      html += `<span class="breaks-title">Breaks (${breaks.length})</span>`;
      breaks.forEach((brk, bi) => {
        html += `<div class="break-card">`;
        html += `<span class="break-num">Break ${bi + 1}</span>`;
        html += '<div class="detail-grid compact">';
        Object.keys(brk).forEach(key => {
          const val = brk[key];
          if (val === undefined || val === null || val === "") return;
          if (typeof val === "object") return;
          html += `
            <div class="detail-field">
              <span class="detail-field-label">${camelToTitle(key)}</span>
              <span class="detail-field-value">${formatDetailValue(val)}</span>
            </div>
          `;
        });
        html += '</div></div>';
      });
      html += '</div>';
    }

    html += '</div>';
  });

  tab.innerHTML = html;
}

function populateRawTab(raw) {
  const tab = document.getElementById("tab-raw");
  let jsonStr;
  try {
    jsonStr = JSON.stringify(raw, null, 2);
  } catch {
    jsonStr = String(raw);
  }

  tab.innerHTML = `
    <div class="raw-json-toolbar">
      <button class="raw-copy-btn" id="rawCopyBtn" title="Copy JSON">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        <span>Copy</span>
      </button>
    </div>
    <pre class="raw-json-block"><code>${escapeHtml(jsonStr)}</code></pre>
  `;

  document.getElementById("rawCopyBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(jsonStr).then(() => {
      const btn = document.getElementById("rawCopyBtn");
      btn.querySelector("span").textContent = "Copied!";
      setTimeout(() => { btn.querySelector("span").textContent = "Copy"; }, 1500);
    });
  });
}

// ── Detail Tabs ──
function setupDetailTabs() {
  document.querySelectorAll(".detail-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      // Deactivate all
      document.querySelectorAll(".detail-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".detail-tab-content").forEach(c => c.classList.remove("active"));
      // Activate clicked
      tab.classList.add("active");
      const target = tab.dataset.tab;
      document.getElementById(`tab-${target}`).classList.add("active");
    });
  });

  // Back button
  detailBack.addEventListener("click", closeRouteDetail);
  
  // Click overlay background to close
  detailOverlay.addEventListener("click", (e) => {
    if (e.target === detailOverlay) closeRouteDetail();
  });
}

// ══════════════════════════════════════════════════════════════
// STATUS / LABELS
// ══════════════════════════════════════════════════════════════

function getStatusClass(status) {
  if (!status) return "";
  const s = status.toLowerCase();
  if (s.includes("complet")) return "completed";
  if (s.includes("progress") || s.includes("transit") || s.includes("deliver")) return "in-progress";
  return "pending";
}

function getStatusLabel(status) {
  if (!status) return "";
  const s = status.toLowerCase();
  if (s.includes("complet")) return "Done";
  if (s.includes("progress") || s.includes("transit") || s.includes("deliver")) return "Active";
  if (s.includes("pending") || s.includes("assign")) return "Pending";
  return status.substring(0, 8);
}

// ══════════════════════════════════════════════════════════════
// BUTTON HANDLERS
// ══════════════════════════════════════════════════════════════

// ── Re-Scrape Button ──
scrapeBtn.addEventListener("click", async () => {
  scrapeBtn.classList.add("loading");
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_NOW" });
    setTimeout(() => {
      loadFromStorage();
      scrapeBtn.classList.remove("loading");
    }, 1500);
  } catch {
    scrapeBtn.classList.remove("loading");
  }
});

// ── Sync to SYMX Button ──
syncBtn.addEventListener("click", async () => {
  if (currentRoutes.length === 0) return;

  syncBtn.disabled = true;
  syncBtn.classList.add("loading");
  syncStatusSection.style.display = "";
  syncResultSection.style.display = "none";

  const target = TARGETS[targetSelect.value] || TARGETS.production;

  try {
    const response = await fetch(`${target}/api/public/extension-sync?key=${encodeURIComponent(API_KEY)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-extension-key": API_KEY,
      },
      body: JSON.stringify({
        routes: currentRoutes,
        date: currentDate,
      }),
    });

    const data = await response.json();

    syncStatusSection.style.display = "none";

    if (!response.ok) {
      throw new Error(data.error || "Sync failed");
    }

    // Show success
    syncResultSection.style.display = "";
    syncResult.className = "sync-result success";
    syncResult.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        Synced successfully to SYMX Systems!
      </div>
      <div class="sync-result-stats">
        <div class="sync-result-stat">
          <span class="stat-num">${data.saved || 0}</span>
          <span class="stat-label">Saved</span>
        </div>
        <div class="sync-result-stat">
          <span class="stat-num">${data.synced || 0}</span>
          <span class="stat-label">Routes Synced</span>
        </div>
        <div class="sync-result-stat">
          <span class="stat-num">${data.matched || 0}</span>
          <span class="stat-label">Drivers Matched</span>
        </div>
      </div>
    `;

    // Update last sync time
    const now = new Date().toISOString();
    chrome.storage.local.set({ lastSync: now });
    lastSyncTime.textContent = "Just now";
  } catch (err) {
    syncStatusSection.style.display = "none";
    syncResultSection.style.display = "";
    syncResult.className = "sync-result error";
    syncResult.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        ${err.message || "Sync failed"}
      </div>
    `;
  } finally {
    syncBtn.classList.remove("loading");
    syncBtn.disabled = false;
  }
});

// ── Target select change ──
targetSelect.addEventListener("change", () => {
  chrome.storage.local.set({ target: targetSelect.value });
});

// ── Listen for new scrape data ──
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SCRAPE_COMPLETE") {
    currentRoutes = message.data;
    renderRoutes(currentRoutes);
    syncBtn.disabled = false;
  }
});

// ══════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════

function getTimeAgo(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function camelToTitle(str) {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, c => c.toUpperCase())
    .replace(/_/g, " ")
    .trim();
}

function formatDetailValue(val) {
  if (val === true) return "Yes";
  if (val === false) return "No";
  if (val === null || val === undefined) return "—";
  if (typeof val === "number") {
    // Format epoch timestamps
    if (val > 1700000000000) {
      try {
        const d = new Date(val);
        return d.toLocaleString("en-US", { 
          month: "short", day: "numeric", 
          hour: "numeric", minute: "2-digit",
          hour12: true
        });
      } catch { return String(val); }
    }
    return val.toLocaleString();
  }
  if (Array.isArray(val)) return val.join(", ");
  return escapeHtml(String(val));
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Start ──
init();
