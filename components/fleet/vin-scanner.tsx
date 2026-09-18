"use client";

import { useEffect, useRef, useState } from "react";
import { IconCamera, IconX, IconAlertTriangle } from "@tabler/icons-react";

// The Barcode Detection API is native, needs no dependency, and covers
// every format a VIN sticker actually uses (Code 39 most commonly, some
// newer OEM labels use Code 128 or a PDF417 2D stack alongside it) — but
// it isn't in TypeScript's DOM lib yet, hence the manual shape below.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): BarcodeDetectorLike;
      getSupportedFormats?: () => Promise<string[]>;
    };
  }
}

// A raw VIN scan can carry lowercase letters or stray whitespace
// depending on the label/printer; VINs are always uppercase and never
// contain I, O, or Q (reserved to avoid confusion with 1 and 0), so
// anything scanning to those characters is almost certainly noise from a
// misread, not a real VIN.
function cleanVin(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
}

/**
 * Camera-based VIN scan button. Opens an overlay with the live camera
 * feed, decodes barcodes with the browser's native Barcode Detection API,
 * and hands the result back — no library, no upload, nothing leaves the
 * browser.
 *
 * Support is currently Chromium-based browsers only (Chrome, Edge,
 * Android WebView — not Safari/iOS as of this writing). Rather than
 * silently doing nothing on an unsupported browser, the button still
 * appears but says so plainly and falls back to typing.
 */
export function VinScannerButton({ onScanned }: { onScanned: (vin: string) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!window.BarcodeDetector);
  }, []);

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startScan() {
    setError(null);
    if (!window.BarcodeDetector) {
      setOpen(true); // shows the "not supported" message below
      return;
    }
    setOpen(true);
    try {
      detectorRef.current = new window.BarcodeDetector({
        formats: ["code_39", "code_128", "pdf417", "ean_13", "codabar"],
      });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      tick();
    } catch (e: any) {
      setError(
        e?.name === "NotAllowedError"
          ? "Camera access was denied. Allow camera access and try again, or type the VIN."
          : "Couldn't start the camera. Type the VIN instead."
      );
    }
  }

  function tick() {
    rafRef.current = requestAnimationFrame(async () => {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (video && detector && video.readyState >= 2) {
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            const vin = cleanVin(barcodes[0].rawValue);
            if (vin.length >= 11) {
              // 11 is generous slack below the real 17 — a partial but
              // plausible read is still worth accepting and letting the
              // person glance at/correct, rather than spinning forever on
              // a label that's scanning inconsistently.
              onScanned(vin);
              closeScanner();
              return;
            }
          }
        } catch { /* a failed single-frame decode just tries again next frame */ }
      }
      tick();
    });
  }

  function closeScanner() {
    stopCamera();
    setOpen(false);
    setError(null);
  }

  useEffect(() => () => stopCamera(), []);

  return (
    <>
      <button
        type="button"
        onClick={startScan}
        title="Scan VIN barcode"
        className="flex items-center justify-center h-full px-2.5 rounded-lg border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors shrink-0"
      >
        <IconCamera size={15} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70" onClick={closeScanner}>
          <div
            className="relative w-full max-w-sm mx-4 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">Scan VIN Barcode</span>
              <button onClick={closeScanner} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
                <IconX size={16} />
              </button>
            </div>

            {supported === false || !window.BarcodeDetector ? (
              <div className="p-6 flex flex-col items-center gap-2 text-center">
                <IconAlertTriangle size={24} className="text-amber-500" />
                <p className="text-sm text-foreground font-medium">Barcode scanning isn't supported in this browser.</p>
                <p className="text-xs text-muted-foreground">Try Chrome or Edge (desktop or Android), or type the VIN in the field.</p>
              </div>
            ) : error ? (
              <div className="p-6 flex flex-col items-center gap-2 text-center">
                <IconAlertTriangle size={24} className="text-red-500" />
                <p className="text-sm text-foreground">{error}</p>
              </div>
            ) : (
              <div className="relative aspect-[4/3] bg-black">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-16 border-2 border-primary/70 rounded-lg pointer-events-none" />
                <p className="absolute bottom-2 inset-x-0 text-center text-[11px] text-white/80">
                  Align the VIN barcode within the frame
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
