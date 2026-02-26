"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";

// Module-level flag: prevents duplicate toasts within the same JS session
// (e.g. if `beforeinstallprompt` fires multiple times or React strict-mode)
let promptShown = false;

const PWA_DISMISSED_KEY = "pwa-install-dismissed";

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

      // Guard 1: already shown this session (handles multiple event firings)
      if (promptShown) return;

      // Guard 2: user previously dismissed/accepted — don't nag them again
      if (localStorage.getItem(PWA_DISMISSED_KEY)) return;

      promptShown = true;

      toast("Install SYMX Systems", {
        description: "Add to your home screen for a faster, app-like experience.",
        icon: <Download className="h-4 w-4" />,
        duration: 15000,
        onDismiss: () => {
          // Suppress the prompt permanently after the user closes it
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
