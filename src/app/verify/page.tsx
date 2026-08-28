"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ProductCapture,
  type CaptureResult,
} from "@/components/ProductCapture";
import { VerifyResult } from "@/components/VerifyResult";
import type { VerifyResponse } from "@/lib/types";

function deviceId() {
  if (typeof window === "undefined") return "ssr";
  const key = "mule-device-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `web-${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export default function VerifyPage() {
  const [payload, setPayload] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoNote, setGeoNote] = useState("Requesting location…");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [reporting, setReporting] = useState(false);
  const [status, setStatus] = useState("Snap or upload a product photo to analyse.");
  const autoRunRef = useRef(0);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoNote("Geolocation unavailable — geospatial checks limited.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGeoNote(
          `Location ready (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`,
        );
      },
      () => setGeoNote("Location denied — geospatial checks limited."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const runVerify = useCallback(
    async (opts?: {
      decodedPayload?: string;
      imageBase64?: string | null;
      mimeType?: string | null;
    }) => {
      const decodedPayload = (opts?.decodedPayload ?? payload).trim();
      const img = opts?.imageBase64 ?? imageBase64;
      const mime = opts?.mimeType ?? mimeType;

      if (!decodedPayload && !img) {
        setError("Snap or upload a photo first.");
        return;
      }

      setLoading(true);
      setError(null);
      setResult(null);
      setStatus(
        img
          ? "AI is inspecting the photo (drug pack? spelling, print, packaging, logo)…"
          : "Running code-based layers…",
      );

      try {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decodedPayload,
            latitude: lat,
            longitude: lng,
            deviceId: deviceId(),
            imageBase64: img,
            mimeType: mime,
            skipAi: false,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || data.error || "Verify failed");
        setResult(data as VerifyResponse);
        setStatus("Analysis complete.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Verification failed");
        setStatus("Analysis failed — try another photo.");
      } finally {
        setLoading(false);
      }
    },
    [payload, imageBase64, mimeType, lat, lng],
  );

  const onCapture = useCallback(
    (capture: CaptureResult) => {
      setPayload(capture.decodedPayload);
      setImageBase64(capture.imageBase64);
      setMimeType(capture.mimeType);
      setPreviewUrl(capture.previewUrl);
      setResult(null);
      setError(null);
      setStatus(
        capture.decodedPayload
          ? `Photo captured · QR found (${capture.decodedPayload.slice(0, 42)}${capture.decodedPayload.length > 42 ? "…" : ""}) · analysing…`
          : "Photo captured · no QR found · analysing pack visually…",
      );
      const token = ++autoRunRef.current;
      void (async () => {
        // slight yield so UI paints preview before request
        await new Promise((r) => setTimeout(r, 50));
        if (token !== autoRunRef.current) return;
        await runVerify({
          decodedPayload: capture.decodedPayload,
          imageBase64: capture.imageBase64,
          mimeType: capture.mimeType,
        });
      })();
    },
    [runVerify],
  );

  async function report() {
    if (!result?.scanEventId) return;
    setReporting(true);
    try {
      await fetch("/api/scans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: result.scanEventId, reported: true }),
      });
    } finally {
      setReporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-ink">
          Verify
        </h1>
        <p className="mt-3 text-ink/75 leading-relaxed">
          Snap <em>anything</em>. Múlẹ̀ checks whether it looks like a medicine
          pack, reads visible details (name, spelling, print, packaging, logo),
          then runs geospatial / frequency layers when a QR/barcode is present.
        </p>
        <p className="mt-2 text-sm text-teal">{geoNote}</p>
        <p className="mt-1 text-sm text-ink/60">{status}</p>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <div>
          <ProductCapture
            onCapture={onCapture}
            onError={setError}
            disabled={loading}
          />

          <div className="mt-6 space-y-3">
            <label className="block text-sm text-ink/70">
              QR / barcode payload (auto-filled when found)
              <input
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                placeholder="Optional — leave blank for photo-only analysis"
                className="mt-1 w-full rounded-md border border-ink/15 bg-white/70 px-3 py-2 text-ink outline-none focus:border-teal"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading || (!payload && !imageBase64)}
                onClick={() => void runVerify()}
                className="rounded-md bg-accent px-5 py-2.5 text-sm text-white hover:brightness-110 disabled:opacity-50"
              >
                {loading ? "Analysing…" : "Re-analyse"}
              </button>
            </div>

            {previewUrl && (
              <p className="text-xs text-ink/55">
                Latest capture ready
                {payload ? " · code detected" : " · photo-only path"}.
              </p>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        <div>
          {loading && (
            <div className="animate-rise space-y-3 border border-teal/20 bg-mist/50 p-6">
              <p className="font-[family-name:var(--font-display)] text-xl text-ink">
                Inspecting your photo…
              </p>
              <p className="text-sm text-ink/70">
                Drug pack detection → spelling / print / packaging / logo → QR
                registry &amp; location/frequency when available → AI remarks
              </p>
            </div>
          )}
          {result && !loading && (
            <VerifyResult
              result={result}
              onReport={() => void report()}
              reporting={reporting}
            />
          )}
          {!result && !loading && (
            <div className="border border-dashed border-teal/30 p-8 text-ink/60">
              After you snap or upload, you&apos;ll see whether it looks like a
              medicine, what details were observed, and the 3-layer audit trail.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
