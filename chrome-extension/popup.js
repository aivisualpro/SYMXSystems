// ══════════════════════════════════════════════════════════════
// SYMX Route Scraper — Popup Controller
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
  const completedCount = routes.filter(r => 
    r.status?.toLowerCase()?.includes("complet") || 
    (r.deliveriesCompleted && r.deliveriesCompleted > 0)
  ).length;

  let html = `
    <div class="summary-bar">
      <span class="sum-val">${routes.length}</span> routes
      <span class="sum-sep">·</span>
      <span class="sum-val">${totalStops.toLocaleString()}</span> stops
      <span class="sum-sep">·</span>
      <span class="sum-val">${totalPkgs.toLocaleString()}</span> pkgs
    </div>
  `;

  routes.forEach(route => {
    const stops = parseInt(route.stopCount) || 0;
    const pkgs = parseInt(route.packageCount) || 0;
    const statusClass = getStatusClass(route.status);
    const statusLabel = getStatusLabel(route.status);
    
    html += `
      <div class="route-item">
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
        </div>
      </div>
    `;
  });

  routeList.innerHTML = html;
}

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
    const response = await fetch(`${target}/api/public/extension-sync`, {
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

// ── Utils ──
function getTimeAgo(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Start ──
init();
