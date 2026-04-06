// ══════════════════════════════════════════════════════════════
// SYMX Route Scraper — Injector Script (ISOLATED world)
// Runs at document_start to set up the messaging bridge
// between MAIN world content.js and the extension background
// ══════════════════════════════════════════════════════════════

// Bridge: listen for messages from MAIN world content.js via window.postMessage
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== "SYMX_CONTENT") return;

  const { type, payload } = event.data;

  if (type === "ROUTES_SCRAPED") {
    // Forward to background script
    chrome.runtime.sendMessage({
      type: "ROUTES_SCRAPED",
      data: payload.routes,
      selectedDate: payload.selectedDate,
      serviceAreaId: payload.serviceAreaId,
    });
  }
});

// Listen for messages from popup/background and forward to MAIN world
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCRAPE_NOW" || message.type === "GET_PAGE_INFO") {
    // Forward to MAIN world via window.postMessage
    window.postMessage({
      source: "SYMX_EXTENSION",
      type: message.type,
    }, "*");

    // Set up a one-time listener for the response
    const handler = (event) => {
      if (event.source !== window) return;
      if (!event.data || event.data.source !== "SYMX_CONTENT") return;
      if (event.data.type === `${message.type}_RESPONSE`) {
        window.removeEventListener("message", handler);
        sendResponse(event.data.payload);
      }
    };
    window.addEventListener("message", handler);

    // Timeout fallback
    setTimeout(() => {
      window.removeEventListener("message", handler);
    }, 5000);

    return true; // keep sendResponse channel open
  }
});
