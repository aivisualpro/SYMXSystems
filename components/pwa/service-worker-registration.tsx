"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";

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

      // Show a toast notification inviting the user to install
      toast("Install SYMX Systems", {
        description: "Add to your home screen for a faster, app-like experience.",
        icon: <Download className="h-4 w-4" />,
        duration: 15000,
        action: {
          label: "Install",
          onClick: async () => {
            const prompt = deferredPromptRef.current;
            if (!prompt) return;
            prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === "accepted") {
              toast.success("App installed successfully!");
            }
            deferredPromptRef.current = null;
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
