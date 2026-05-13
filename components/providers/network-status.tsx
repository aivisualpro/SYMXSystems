"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/notify";

/**
 * NetworkStatusProvider — detects online/offline transitions and:
 *  1. Shows a persistent toast when the user goes offline.
 *  2. Dismisses the toast + invalidates all queries when back online.
 *  3. Replays any queued mutations that failed due to network errors.
 *
 * Mount this inside <QueryClientProvider>.
 */

const OFFLINE_TOAST_ID = "network-offline-toast";
const MAX_QUEUED = 20;

interface QueuedMutation {
  fn: () => Promise<unknown>;
  label: string;
  queuedAt: number;
}

export function NetworkStatusProvider() {
  const queryClient = useQueryClient();
  const retryQueue = useRef<QueuedMutation[]>([]);

  /**
   * Queue a failed mutation for retry when connectivity returns.
   * Called from the global mutation cache's onError handler.
   */
  const queueMutation = useCallback((fn: () => Promise<unknown>, label: string) => {
    if (retryQueue.current.length >= MAX_QUEUED) {
      // Drop the oldest entry
      const dropped = retryQueue.current.shift();
      if (dropped) {
        notify.warning(`Dropped queued action "${dropped.label}" — queue full`);
      }
    }
    retryQueue.current.push({ fn, label, queuedAt: Date.now() });
  }, []);

  /**
   * Replay all queued mutations in order.
   */
  const replayQueue = useCallback(async () => {
    const items = retryQueue.current.splice(0);
    if (items.length === 0) return;
    notify.info(`Syncing ${items.length} queued change${items.length > 1 ? "s" : ""}…`);
    for (const item of items) {
      try {
        await item.fn();
      } catch {
        // Individual failure — don't re-queue endlessly
        console.warn(`[NetworkStatus] Retry failed for "${item.label}"`);
      }
    }
  }, []);

  useEffect(() => {
    // -- Expose queueMutation globally so the mutation cache can access it
    (window as any).__networkRetryQueue = queueMutation;

    const handleOffline = () => {
      notify.warning("You're offline — changes will sync when you reconnect.", {
        id: OFFLINE_TOAST_ID,
        duration: Infinity,
      });
    };

    const handleOnline = () => {
      notify.dismiss(OFFLINE_TOAST_ID);
      notify.success("Back online — syncing data…", { duration: 2000 });
      // Refetch all stale data
      queryClient.invalidateQueries();
      // Replay any queued mutations
      replayQueue();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    // If already offline at mount time, show the toast immediately
    if (typeof window !== "undefined" && !window.navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      delete (window as any).__networkRetryQueue;
    };
  }, [queryClient, queueMutation, replayQueue]);

  // This is a headless provider — no UI of its own.
  return null;
}
