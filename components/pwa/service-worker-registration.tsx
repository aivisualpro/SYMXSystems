"use client";

import { useEffect, useCallback, useState } from "react";
import { notify } from "@/lib/notify";

export function ServiceWorkerRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  const handleUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      // Reload once the new SW takes over
      waitingWorker.addEventListener("statechange", () => {
        if (waitingWorker.state === "activated") {
          window.location.reload();
        }
      });
    }
  }, [waitingWorker]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Never register the outer SW inside the Flutter /app/ scope — and clean up any stale ones
    if (window.location.pathname.startsWith("/app")) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Service Worker registered successfully

        // Detect updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New SW installed but waiting → show toast and dispatch event
              setWaitingWorker(newWorker);
              window.dispatchEvent(new CustomEvent("pwa-update-available", { detail: newWorker }));
             notify.custom("App update available!", {
                description: "Tap to refresh and get the latest version.",
                action: {
                  label: "Update",
                  onClick: () => {
                    newWorker.postMessage({ type: "SKIP_WAITING" });
                    window.location.reload();
                  },
                },
                duration: 10000,
              });
            }
          });
        });

        // Check for updates periodically (every 30 min)
        setInterval(() => {
          registration.update();
        }, 30 * 60 * 1000);

        // Also check for updates when the app comes back from background
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update();
          }
        });
      })
      .catch((err) => {
        console.warn("[PWA] Service Worker registration failed:", err);
      });

    // Listen for controller change (new SW activated) → reload
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    // Suppress the browser's native install prompt — we can trigger it later
    const handleBeforeInstall = (e: Event) => {
      // Store the event for potential "Install App" button
      (window as any).__pwaInstallPrompt = e;
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  return null;
}
