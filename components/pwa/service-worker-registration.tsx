"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";

const PWA_DISMISSED_KEY = "pwa-install-dismissed";
const PWA_SESSION_KEY = "pwa-prompt-shown-this-session";
const TOAST_ID = "pwa-install-toast"; // unique ID prevents Sonner from stacking duplicates

export function ServiceWorkerRegistration() {
  const deferredPromptRef = useRef<any>(null);

  useEffect(() => {
    // ── Service Worker Registration ───────────────────────────────
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[PWA] Service Worker registered, scope:", registration.scope);

          // Check for updates periodically (every 60 min)
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err);
        });
    }

    // ── Install Prompt ────────────────────────────────────────────
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;

      // Guard 1: user already dismissed/accepted — never show again
      if (localStorage.getItem(PWA_DISMISSED_KEY)) return;

      // Guard 2: already shown during this browser session
      // (handles React Strict Mode double-mount + SPA route changes)
      if (sessionStorage.getItem(PWA_SESSION_KEY)) return;

      // Mark as shown for this session immediately to block race conditions
      sessionStorage.setItem(PWA_SESSION_KEY, "1");

      // Dismiss any existing instance of this toast before showing
      // (prevents stacking if the event somehow fires again)
      toast.dismiss(TOAST_ID);

      toast("Install SYMX Systems", {
        id: TOAST_ID, // Sonner deduplicates by ID — only one will ever show
        description: "Add to your home screen for a faster, app-like experience.",
        icon: <Download className="h-4 w-4" />,
        duration: 15000,
        onDismiss: () => {
          localStorage.setItem(PWA_DISMISSED_KEY, "1");
        },
        action: {
          label: "Install",
          onClick: async () => {
            const prompt = deferredPromptRef.current;
            if (!prompt) return;
            prompt.prompt();
            const { outcome } = await prompt.userChoice;
            deferredPromptRef.current = null;
            localStorage.setItem(PWA_DISMISSED_KEY, "1");
            if (outcome === "accepted") {
              toast.success("App installed successfully!");
            }
          },
        },
      });
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  return null;
}
