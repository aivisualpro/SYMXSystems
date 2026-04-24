// ══════════════════════════════════════════════════════════════
// SYMX Route Scraper — Injector Script (ISOLATED world) V.1.0.5
// Runs at document_start to set up the messaging bridge
// between MAIN world content.js and the extension background
// ══════════════════════════════════════════════════════════════

// Helper: check if extension context is still valid (not invalidated after update/reload)
function isExtensionContextValid() {
  try {
    // Accessing chrome.runtime.id throws if context is invalidated
    return !!chrome.runtime && !!chrome.runtime.id;
  } catch {
    return false;
  }
}

// Bridge: listen for messages from MAIN world content.js via window.postMessage
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== "SYMX_CONTENT") return;

  const { type, payload } = event.data;

  if (type === "ROUTES_SCRAPED") {
    if (!isExtensionContextValid()) {
      console.warn("[SYMX Extension] Extension context invalidated. Please refresh the page to reconnect.");
      return;
    }
    // Forward to background script
    try {
      chrome.runtime.sendMessage({
        type: "ROUTES_SCRAPED",
        data: payload.routes,
        selectedDate: payload.selectedDate,
        serviceAreaId: payload.serviceAreaId,
      });
    } catch (err) {
      console.warn("[SYMX Extension] Could not send message to extension (context invalidated). Please refresh the page.", err);
    }
  }
});

// Listen for messages from popup/background and forward to MAIN world
// Guard: only register if context is still valid
if (isExtensionContextValid()) {
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Re-check inside the listener in case context was invalidated after registration
      if (!isExtensionContextValid()) return;

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
            try {
              sendResponse(event.data.payload);
            } catch {
              // sendResponse may fail if context invalidated
            }
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
  } catch (err) {
    console.warn("[SYMX Extension] Could not register message listener (context invalidated).", err);
  }
}
