"use client";
import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";

// "Mobile view" = the phone card layout some pages (Dispatching → Routes) use
// on narrow screens. It is on by default on a phone; the user can switch it
// off from the top bar to get the full desktop table, and back on again.
// The choice is remembered on this device only.
const KEY = "symx_mobile_view_off";
const EVENT = "symx-mobile-view-change";

function readOff(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function useMobileView() {
  const isPhone = useIsMobile();
  const [off, setOff] = React.useState(false);

  React.useEffect(() => {
    setOff(readOff());
    const sync = () => setOff(readOff());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setMobileView = React.useCallback((on: boolean) => {
    try { localStorage.setItem(KEY, on ? "0" : "1"); } catch { /* private mode: keep in-memory only */ }
    setOff(!on);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return {
    /** Screen is phone-sized (the toggle is only offered then). */
    isPhone,
    /** Phone card layout should be used right now. */
    mobileView: isPhone && !off,
    setMobileView,
  };
}
