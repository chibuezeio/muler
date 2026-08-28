"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  onScan: (payload: string, imageBase64?: string, mimeType?: string) => void;
  onError?: (message: string) => void;
};

export function QrScanner({ onScan, onError }: Props) {
  const regionId = useId().replace(/:/g, "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    }
    setActive(false);
  }

  async function startCamera() {
    setBusy(true);
    handled.current = false;
    try {
      await stopScanner();
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(regionId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (handled.current) return;
          handled.current = true;
          onScan(decoded);
          void stopScanner();
        },
        () => undefined,
      );
      setActive(true);
    } catch (e) {
      onError?.(
        e instanceof Error
          ? e.message
          : "Camera permission denied or unavailable. Try uploading an image.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    handled.current = false;
    try {
      await stopScanner();
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(regionId);
      scannerRef.current = scanner;
      const decoded = await scanner.scanFile(file, true);
      const dataUrl = await fileToDataUrl(file);
      const base64 = dataUrl.split(",")[1];
      onScan(decoded, base64, file.type || "image/jpeg");
      await scanner.clear();
      scannerRef.current = null;
    } catch {
      try {
        const dataUrl = await fileToDataUrl(file);
        const base64 = dataUrl.split(",")[1];
        onScan("", base64, file.type || "image/jpeg");
      } catch {
        onError?.("Could not read the uploaded image.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="scan-frame relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-lg bg-ink/90">
        <div
          id={regionId}
          className="h-full w-full [&_img]:h-full [&_img]:w-full [&_img]:object-cover [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />
        {!active && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-mist/80">
            Start the camera or upload a packaging image with a QR/barcode.
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void startCamera()}
          className="rounded-md bg-teal px-4 py-2 text-sm text-white transition hover:bg-teal-deep disabled:opacity-50"
        >
          {active ? "Restart camera" : "Start camera"}
        </button>
        {active && (
          <button
            type="button"
            onClick={() => void stopScanner()}
            className="rounded-md border border-ink/20 px-4 py-2 text-sm text-ink hover:bg-mist"
          >
            Stop
          </button>
        )}
        <label className="cursor-pointer rounded-md border border-ink/20 px-4 py-2 text-sm text-ink hover:bg-mist">
          Upload image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
