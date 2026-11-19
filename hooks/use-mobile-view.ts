"use client";
import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";

// Device modes for the pages that have touch-friendly layouts (Dispatching, Closing):
//   phone   — narrow screen: card layouts / one panel at a time
//   tablet  — wide TOUCH screen (iPad, unfolded foldable): full layout, but wrapped top bar
//             and an optional "fit to screen" so the whole table is visible
//   desktop — everything else
// Both can be switched off from the top bar (remembered on this device only), and the
// choice is shared by every page that reads it.
const KEY = "symx_mobile_view_off";
const FIT_KEY = "symx_fit_off";
const EVENT = "symx-mobile-view-change";
const TABLET_MIN = 768;
const TABLET_MAX = 1400;

function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) === "1"; } catch { return false; }
}

export function useMobileView() {
  const isPhone = useIsMobile();
  const [off, setOff] = React.useState(false);
  const [fitOff, setFitOff] = React.useState(false);
  const [isTablet, setIsTablet] = React.useState(false);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const syncPrefs = () => { setOff(readFlag(KEY)); setFitOff(readFlag(FIT_KEY)); };
    const syncDevice = () => {
      const w = window.innerWidth;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      setWidth(w);
      setIsTablet(coarse && w >= TABLET_MIN && w < TABLET_MAX);
    };
    syncPrefs();
    syncDevice();
    window.addEventListener(EVENT, syncPrefs);
    window.addEventListener("storage", syncPrefs);
    window.addEventListener("resize", syncDevice);
    window.addEventListener("orientationchange", syncDevice);
    return () => {
      window.removeEventListener(EVENT, syncPrefs);
      window.removeEventListener("storage", syncPrefs);
      window.removeEventListener("resize", syncDevice);
      window.removeEventListener("orientationchange", syncDevice);
    };
  }, []);

  const setFlag = React.useCallback((key: string, value: boolean) => {
    try { localStorage.setItem(key, value ? "1" : "0"); } catch { /* private mode: in-memory only */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const setMobileView = React.useCallback((on: boolean) => { setOff(!on); setFlag(KEY, !on); }, [setFlag]);
  const setFitToScreen = React.useCallback((on: boolean) => { setFitOff(!on); setFlag(FIT_KEY, !on); }, [setFlag]);

  return {
    /** Screen is phone-sized. */
    isPhone,
    /** Wide touch screen (tablet / unfolded foldable). */
    isTablet,
    /** Current window width in CSS px (0 before mount). */
    width,
    /** Phone card layout should be used right now. */
    mobileView: isPhone && !off,
    /** Touch-tablet layout should be used right now. */
    tabletView: isTablet && !off,
    setMobileView,
    /** Shrink wide tables so the whole thing is visible (tablet view only). */
    fitToScreen: !fitOff,
    setFitToScreen,
  };
}
