// ══════════════════════════════════════════════════════════════
// SYMX Route Fetch — Popup Controller V.1.0.2
// ══════════════════════════════════════════════════════════════

const SYNC_TARGET = "https://symx-systems.vercel.app";
const API_KEY = "symx-ext-route-sync-2026";

// DOM Elements
const statusDot = document.getElementById("statusDot");
const pageInfoSection = document.getElementById("pageInfoSection");
const dateValue = document.getElementById("dateValue");
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
const lastSyncTime = document.getElementById("lastSyncTime");
const searchBar = document.getElementById("searchBar");
const searchInput = document.getElementById("searchInput");

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
  // Restore last sync time
  chrome.storage.local.get(["lastSync"], (result) => {
    if (result.lastSync) {
      const ago = getTimeAgo(new Date(result.lastSync));
      lastSyncTime.textContent = `Last sync: ${ago}`;
    }
  });

  // Check current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab?.url?.includes("logistics.amazon.com")) {
    statusDot.className = "status-dot disconnected";
    return;
  }

  statusDot.className = "status-dot connected";

  // Get page info from content script
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_INFO" });
    
    if (response?.isAmazonLogistics) {
      // Show date info
      if (response.selectedDay) {
        pageInfoSection.style.display = "";
        const d = new Date(response.selectedDay + "T12:00:00Z");
        dateValue.textContent = d.toLocaleDateString("en-US", { 
          weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" 
        });
        currentDate = response.selectedDay;
      }
      
      routesSection.style.display = "";
      actionsSection.style.display = "";

      // Load any previously captured data
      if (response.capturedCount > 0) {
        loadCapturedData();
      } else {
        loadFromStorage();
      }
    }
  } catch (e) {
    statusDot.className = "status-dot warning";
    routesSection.style.display = "";
    actionsSection.style.display = "";
    loadFromStorage();
  }

  // Set up search
  setupSearch();
  // Set up detail tabs
  setupDetailTabs();
}

// ── Search ──
function setupSearch() {
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      renderRoutes(currentRoutes);
      return;
    }
    const filtered = currentRoutes.filter(r => {
      const code = (r.routeCode || "").toLowerCase();
      const tid = (r.transporterId || "").toLowerCase();
      const tname = (r.transporterName || "").toLowerCase();
      return code.includes(q) || tid.includes(q) || tname.includes(q);
    });
    renderRoutes(filtered, true);
  });
}

async function loadCapturedData() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_NOW" });
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

function renderRoutes(routes, isFiltered = false) {
  if (!isFiltered) {
    routeCountBadge.textContent = routes.length;
    // Show search bar if we have routes
    searchBar.style.display = routes.length > 0 ? "" : "none";
  }
  
  if (routes.length === 0) {
    if (isFiltered) {
      routeList.innerHTML = `<div class="empty-state"><p>No matching routes</p></div>`;
    } else {
      routeList.innerHTML = emptyState.outerHTML;
    }
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
    // Find the original index in currentRoutes for detail view
    const origIdx = currentRoutes.indexOf(route);
    const stops = parseInt(route.stopCount) || 0;
    const pkgs = parseInt(route.packageCount) || 0;
    const statusClass = getStatusClass(route.status);
    const statusLabel = getStatusLabel(route.status);
    
    html += `
      <div class="route-item" data-route-idx="${origIdx >= 0 ? origIdx : idx}">
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
          <button class="route-detail-btn" title="View Details" data-route-idx="${origIdx >= 0 ? origIdx : idx}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  });

  routeList.innerHTML = html;

  // Attach click handlers
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

  populateSummaryTab(route, raw);
  populateTransportersTab(raw);
  populateRawTab(raw);

  detailOverlay.classList.add("visible");
}

function closeRouteDetail() {
  detailOverlay.classList.remove("visible");
}

function populateSummaryTab(route, raw) {
  const tab = document.getElementById("tab-summary");
  const rdp = raw.routeDeliveryProgress || {};
  
  const fields = [
    { label: "Route ID", value: raw.routeId },
    { label: "Route Code", value: raw.routeCode || route.routeCode },
    { label: "Service Area ID", value: raw.serviceAreaId },
    { label: "Route Status", value: raw.routeStatus },
    { label: "Progress Status", value: raw.progressStatus },
    { label: "Total Stops", value: rdp.totalStops ?? route.stopCount },
    { label: "Completed Stops", value: rdp.completedStops },
    { label: "Total Deliveries", value: rdp.totalDeliveries },
    { label: "Completed Deliveries", value: rdp.completedDeliveries },
    { label: "Successful Deliveries", value: rdp.successfulDeliveries },
    { label: "Total Pickups", value: rdp.totalPickUps },
    { label: "Total Tasks", value: rdp.totalTasks },
    { label: "Completed Tasks", value: rdp.completedTasks },
    { label: "Unassigned Packages", value: rdp.unassignedPackages },
    { label: "Total Locations", value: rdp.totalLocations },
    { label: "Transporter ID (RMS)", value: raw.transporterIdFromRms },
    { label: "Company ID", value: raw.companyId },
    { label: "Service Type", value: raw.serviceTypeName },
    { label: "Route Duration (s)", value: raw.routeDuration },
    { label: "Planned Departure", value: raw.plannedDepartureTime },
    { label: "Route Labels", value: raw.routeLabels },
    { label: "Late Departing", value: raw.lateDeparting },
    { label: "Pre-Dispatch", value: raw.preDispatch },
    { label: "Route Creation Time", value: raw.routeCreationTime ? raw.routeCreationTime * 1000 : undefined },
    { label: "RMS Route ID", value: raw.rmsRouteId },
  ];

  // Package summary
  if (rdp.routePackageSummary) {
    Object.entries(rdp.routePackageSummary).forEach(([k, v]) => {
      fields.push({ label: `Packages: ${k}`, value: v });
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
    const tRdp = t.routeDeliveryProgress || {};
    html += `<div class="transporter-card">`;
    html += `<div class="transporter-header">`;
    html += `<span class="transporter-num">Transporter ${i + 1}</span>`;
    if (t.transporterId) html += `<span class="transporter-id">${t.transporterId}</span>`;
    html += `</div>`;

    // Key transporter fields
    const tFields = [
      { label: "Itinerary ID", value: t.itineraryId },
      { label: "Itinerary Status", value: t.itineraryStatus },
      { label: "Block Duration (min)", value: t.blockDurationInMinutes },
      { label: "VIN", value: t.vin },
      { label: "Stop Rate", value: t.stopCompletionRate },
      { label: "Stops Last Hour", value: t.completedStopsInLastHour },
      { label: "Total Stops", value: tRdp.totalStops },
      { label: "Completed Stops", value: tRdp.completedStops },
      { label: "Total Deliveries", value: tRdp.totalDeliveries },
      { label: "Completed Deliveries", value: tRdp.completedDeliveries },
      { label: "Itinerary Start", value: t.itineraryStartTime },
      { label: "Actual Departure", value: t.actualRouteDepartureTime },
      { label: "Schedule End", value: t.scheduleEndTime },
      { label: "Total Breaks (s)", value: t.totalBreaksDurationSecs },
    ];

    html += '<div class="detail-grid compact">';
    tFields.forEach(f => {
      if (f.value === undefined || f.value === null || f.value === "") return;
      html += `
        <div class="detail-field">
          <span class="detail-field-label">${f.label}</span>
          <span class="detail-field-value">${formatDetailValue(f.value)}</span>
        </div>
      `;
    });
    html += '</div>';

    // Associated Routes
    if (t.associatedRoutes?.length) {
      html += `<div class="breaks-section">`;
      html += `<span class="breaks-title">Associated Routes (${t.associatedRoutes.length})</span>`;
      html += '<div class="detail-grid compact">';
      t.associatedRoutes.forEach(ar => {
        html += `<div class="detail-field"><span class="detail-field-label">${ar.routeCode}</span><span class="detail-field-value">${ar.routeId}</span></div>`;
      });
      html += '</div></div>';
    }

    // Planned Breaks
    const plannedBreaks = t.plannedBreaks || [];
    if (plannedBreaks.length > 0) {
      html += `<div class="breaks-section">`;
      html += `<span class="breaks-title">Planned Breaks (${plannedBreaks.length})</span>`;
      plannedBreaks.forEach((brk, bi) => {
        html += `<div class="break-card">`;
        html += `<span class="break-num">${brk.type || "Break"} ${bi + 1}</span>`;
        html += '<div class="detail-grid compact">';
        html += `<div class="detail-field"><span class="detail-field-label">Start</span><span class="detail-field-value">${formatDetailValue(brk.plannedStart)}</span></div>`;
        html += `<div class="detail-field"><span class="detail-field-label">End</span><span class="detail-field-value">${formatDetailValue(brk.plannedEnd)}</span></div>`;
        html += `<div class="detail-field"><span class="detail-field-label">Duration</span><span class="detail-field-value">${Math.round((brk.minDurationInMillis || 0) / 60000)}m</span></div>`;
        html += `<div class="detail-field"><span class="detail-field-label">Seq #</span><span class="detail-field-value">${brk.plannedSequenceNumber ?? "—"}</span></div>`;
        html += '</div></div>';
      });
      html += '</div>';
    }

    // Actual Breaks
    const actualBreaks = t.breaks || [];
    if (actualBreaks.length > 0) {
      html += `<div class="breaks-section">`;
      html += `<span class="breaks-title" style="color:var(--info)">Actual Breaks (${actualBreaks.length})</span>`;
      actualBreaks.forEach((brk, bi) => {
        html += `<div class="break-card" style="border-color:rgba(59,130,246,0.15);background:rgba(59,130,246,0.04);">`;
        html += `<span class="break-num">${brk.type || "Break"} ${bi + 1}</span>`;
        html += '<div class="detail-grid compact">';
        html += `<div class="detail-field"><span class="detail-field-label">Clock On</span><span class="detail-field-value">${formatDetailValue(brk.timeStampOn)}</span></div>`;
        html += `<div class="detail-field"><span class="detail-field-label">Clock Off</span><span class="detail-field-value">${formatDetailValue(brk.timeStampOff)}</span></div>`;
        html += `<div class="detail-field"><span class="detail-field-label">State</span><span class="detail-field-value">${brk.state || "—"}</span></div>`;
        html += `<div class="detail-field"><span class="detail-field-label">Seq #</span><span class="detail-field-value">${brk.sequenceNumber ?? "—"}</span></div>`;
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
      document.querySelectorAll(".detail-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".detail-tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
    });
  });

  detailBack.addEventListener("click", closeRouteDetail);
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

syncBtn.addEventListener("click", async () => {
  if (currentRoutes.length === 0) return;

  syncBtn.disabled = true;
  syncBtn.classList.add("loading");
  syncStatusSection.style.display = "";
  syncResultSection.style.display = "none";

  try {
    const response = await fetch(`${SYNC_TARGET}/api/public/extension-sync?key=${encodeURIComponent(API_KEY)}`, {
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

    syncResultSection.style.display = "";
    syncResult.className = "sync-result success";
    syncResult.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        Synced successfully!
      </div>
      <div class="sync-result-stats">
        <div class="sync-result-stat">
          <span class="stat-num">${data.saved || 0}</span>
          <span class="stat-label">Saved</span>
        </div>
        <div class="sync-result-stat">
          <span class="stat-num">${data.synced || 0}</span>
          <span class="stat-label">Routes</span>
        </div>
        <div class="sync-result-stat">
          <span class="stat-num">${data.matched || 0}</span>
          <span class="stat-label">Matched</span>
        </div>
      </div>
    `;

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
    // Format epoch timestamps (> year 2020 in ms)
    if (val > 1577836800000) {
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
