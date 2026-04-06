// ══════════════════════════════════════════════════════════════
// SYMX Route Scraper — Background Service Worker
// ══════════════════════════════════════════════════════════════

const SYMX_API_BASE = "https://symx-systems.vercel.app";
const SYMX_API_KEY = "symx-ext-route-sync-2026";

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

    // Notify popup if open
    chrome.runtime.sendMessage({ type: "SCRAPE_COMPLETE", data: message.data });
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
