"use client";

import { useEffect, useRef, useState } from "react";

export type CaptureResult = {
  imageBase64: string;
  mimeType: string;
  decodedPayload: string;
  previewUrl: string;
};

type Props = {
  onCapture: (result: CaptureResult) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
};

export function ProductCapture({ onCapture, onError, disabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
  }

  async function startCamera() {
    setBusy(true);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLive(true);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } catch (e) {
      onError?.(
        e instanceof Error
          ? e.message
          : "Camera permission denied. You can still upload a photo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function tryDecodeQr(fileOrBlob: Blob): Promise<string> {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const id = `mule-decode-${Date.now()}`;
      const holder = document.createElement("div");
      holder.id = id;
      holder.style.display = "none";
      document.body.appendChild(holder);
      const scanner = new Html5Qrcode(id);
      const file =
        fileOrBlob instanceof File
          ? fileOrBlob
          : new File([fileOrBlob], "snap.jpg", { type: fileOrBlob.type || "image/jpeg" });
      try {
        const decoded = await scanner.scanFile(file, false);
        await scanner.clear();
        holder.remove();
        return decoded;
      } catch {
        try {
          await scanner.clear();
        } catch {
          /* ignore */
        }
        holder.remove();
        return "";
      }
    } catch {
      return "";
    }
  }

  async function emitFromBlob(blob: Blob, mimeType: string) {
    const prepared = await compressImage(blob, mimeType);
    const preview = URL.createObjectURL(prepared.blob);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return preview;
    });

    const dataUrl = await blobToDataUrl(prepared.blob);
    const base64 = dataUrl.split(",")[1] ?? "";
    const decodedPayload = await tryDecodeQr(prepared.blob);

    onCapture({
      imageBase64: base64,
      mimeType: prepared.mimeType,
      decodedPayload,
      previewUrl: preview,
    });
  }

  async function snap() {
    const video = videoRef.current;
    if (!video || !live) {
      onError?.("Start the camera first, then snap.");
      return;
    }
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not capture frame");
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("Could not capture frame");
      stopCamera();
      await emitFromBlob(blob, "image/jpeg");
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Snap failed");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      stopCamera();
      await emitFromBlob(file, file.type || "image/jpeg");
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Could not read image");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="scan-frame relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-lg bg-ink/90">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Captured product"
            className="h-full w-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full object-cover ${live ? "" : "opacity-0"}`}
          />
        )}
        {!live && !previewUrl && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-mist/85">
            Snap any product photo — Múlẹ̀ will say if it looks like a medicine
            pack and what looks off.
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => void startCamera()}
          className="rounded-md bg-teal px-4 py-2 text-sm text-white transition hover:bg-teal-deep disabled:opacity-50"
        >
          {live ? "Restart camera" : "Start camera"}
        </button>
        <button
          type="button"
          disabled={busy || disabled || !live}
          onClick={() => void snap()}
          className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:brightness-110 disabled:opacity-50"
        >
          Snap photo
        </button>
        {live && (
          <button
            type="button"
            disabled={busy}
            onClick={stopCamera}
            className="rounded-md border border-ink/20 px-4 py-2 text-sm text-ink hover:bg-mist"
          >
            Stop
          </button>
        )}
        <label className="cursor-pointer rounded-md border border-ink/20 px-4 py-2 text-sm text-ink hover:bg-mist">
          Upload photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={busy || disabled}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Downscale/re-encode so Azure vision accepts the image and payloads stay small. */
async function compressImage(
  blob: Blob,
  mimeType: string,
): Promise<{ blob: Blob; mimeType: string }> {
  try {
    const bitmap = await createImageBitmap(blob);
    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob, mimeType: mimeType || "image/jpeg" };
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.88),
    );
    if (!out) return { blob, mimeType: mimeType || "image/jpeg" };
    return { blob: out, mimeType: "image/jpeg" };
  } catch {
    return { blob, mimeType: mimeType || "image/jpeg" };
  }
}
