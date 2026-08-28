"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Hotspot } from "@/components/HotspotMap";

const HotspotMap = dynamic(
  () => import("@/components/HotspotMap").then((m) => m.HotspotMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[380px] items-center justify-center border border-teal/20 text-ink/60">
        Loading map…
      </div>
    ),
  },
);

type ScanRow = {
  id: string;
  decodedPayload: string;
  latitude: number | null;
  longitude: number | null;
  outcome: string;
  riskFlags: string[];
  aiRemark: string | null;
  distanceMiles: number | null;
  hoursSinceLast: number | null;
  scanCountAtTime: number;
  reported: boolean;
  createdAt: string;
  layer1Pass: boolean;
  layer2Pass: boolean;
  layer3Pass: boolean;
  product: {
    productId: string;
    name: string;
    batch: string;
    manufacturer: string;
  } | null;
};

type Thresholds = {
  maxMilesX: number;
  minHoursY: number;
  maxScansN: number;
};

export default function DashboardPage() {
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [thresholds, setThresholds] = useState<Thresholds>({
    maxMilesX: 50,
    minHoursY: 2,
    maxScansN: 25,
  });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<
    "ALL" | "LIKELY_FAKE" | "CLEARED" | "NOT_A_DRUG"
  >("ALL");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [scansRes, hotRes, thRes] = await Promise.all([
      fetch("/api/scans?limit=200"),
      fetch("/api/hotspots"),
      fetch("/api/thresholds"),
    ]);
    const scansJson = await scansRes.json();
    const hotJson = await hotRes.json();
    const thJson = await thRes.json();
    setScans(scansJson.scans ?? []);
    setHotspots(hotJson.hotspots ?? []);
    setThresholds({
      maxMilesX: thJson.maxMilesX,
      minHoursY: thJson.minHoursY,
      maxScansN: thJson.maxScansN,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return scans;
    return scans.filter((s) => s.outcome === filter);
  }, [scans, filter]);

  const stats = useMemo(() => {
    const total = scans.length;
    const fake = scans.filter((s) => s.outcome === "LIKELY_FAKE").length;
    const cleared = scans.filter((s) => s.outcome === "CLEARED").length;
    const reported = scans.filter((s) => s.reported).length;
    return { total, fake, cleared, reported };
  }, [scans]);

  async function saveThresholds() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/thresholds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(thresholds),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMessage("Thresholds updated for subsequent verifications.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function toggleReport(id: string, reported: boolean) {
    await fetch("/api/scans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reported }),
    });
    await load();
  }

  function exportCsv() {
    const headers = [
      "id",
      "createdAt",
      "outcome",
      "productId",
      "name",
      "payload",
      "lat",
      "lng",
      "distanceMiles",
      "hoursSinceLast",
      "scanCount",
      "layer1",
      "layer2",
      "layer3",
      "riskFlags",
      "reported",
      "aiRemark",
    ];
    const rows = filtered.map((s) =>
      [
        s.id,
        s.createdAt,
        s.outcome,
        s.product?.productId ?? "",
        s.product?.name ?? "",
        s.decodedPayload,
        s.latitude ?? "",
        s.longitude ?? "",
        s.distanceMiles ?? "",
        s.hoursSinceLast ?? "",
        s.scanCountAtTime,
        s.layer1Pass,
        s.layer2Pass,
        s.layer3Pass,
        s.riskFlags.join("|"),
        s.reported,
        JSON.stringify(s.aiRemark ?? ""),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mule-scans-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-ink">
            Research Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-ink/75">
            Scan history, geospatial hotspots, and regulator-style thresholds (X
            miles, Y hours, n scans) as described in the manuscript results.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-md border border-ink/20 px-4 py-2 text-sm hover:bg-mist"
        >
          Export CSV
        </button>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        <Stat label="Total scans" value={stats.total} />
        <Stat label="Cleared" value={stats.cleared} tone="ok" />
        <Stat label="Likely fake" value={stats.fake} tone="danger" />
        <Stat label="Reported" value={stats.reported} tone="accent" />
      </div>

      <section className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink">
            Counterfeit hotspots
          </h2>
          <p className="mt-1 mb-4 text-sm text-ink/65">
            Aggregated scan clusters for inspection prioritisation.
          </p>
          <HotspotMap hotspots={hotspots} />
        </div>

        <div className="border border-teal/20 bg-mist/40 p-5">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink">
            Thresholds
          </h2>
          <p className="mt-1 text-sm text-ink/65">
            Region / supply-chain dependent (manuscript §4.1).
          </p>
          <div className="mt-5 space-y-4">
            <label className="block text-sm">
              X — max miles between scans
              <input
                type="number"
                min={1}
                step={1}
                value={thresholds.maxMilesX}
                onChange={(e) =>
                  setThresholds((t) => ({
                    ...t,
                    maxMilesX: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-md border border-ink/15 bg-white/80 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Y — min hours between distant-ish scans
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={thresholds.minHoursY}
                onChange={(e) =>
                  setThresholds((t) => ({
                    ...t,
                    minHoursY: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-md border border-ink/15 bg-white/80 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              n — max scans before reprint risk
              <input
                type="number"
                min={1}
                step={1}
                value={thresholds.maxScansN}
                onChange={(e) =>
                  setThresholds((t) => ({
                    ...t,
                    maxScansN: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-md border border-ink/15 bg-white/80 px-3 py-2"
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveThresholds()}
              className="rounded-md bg-teal px-4 py-2 text-sm text-white hover:bg-teal-deep disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save thresholds"}
            </button>
            {message && <p className="text-sm text-ink/70">{message}</p>}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink">
            Scan log
          </h2>
          <div className="flex gap-1 text-sm">
            {(["ALL", "CLEARED", "LIKELY_FAKE", "NOT_A_DRUG"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 ${
                  filter === f
                    ? "bg-ink text-white"
                    : "border border-ink/15 hover:bg-mist"
                }`}
              >
                {f === "LIKELY_FAKE"
                  ? "Likely fake"
                  : f === "NOT_A_DRUG"
                    ? "Not a drug"
                    : f === "ALL"
                      ? "All"
                      : "Cleared"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto border border-teal/15">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-ink text-mist">
              <tr>
                <th className="px-3 py-2 font-normal">When</th>
                <th className="px-3 py-2 font-normal">Product</th>
                <th className="px-3 py-2 font-normal">Outcome</th>
                <th className="px-3 py-2 font-normal">L1/L2/L3</th>
                <th className="px-3 py-2 font-normal">Geo / freq</th>
                <th className="px-3 py-2 font-normal">Regulatory</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-teal/10 odd:bg-white/40">
                  <td className="px-3 py-2 whitespace-nowrap text-ink/70">
                    {new Date(s.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">
                      {s.product?.name ?? "Unrecognised"}
                    </div>
                    <div className="text-xs text-ink/55">
                      {s.product?.productId ?? s.decodedPayload}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        s.outcome === "LIKELY_FAKE" ? "text-danger" : "text-ok"
                      }
                    >
                      {s.outcome}
                    </span>
                    {s.riskFlags.length > 0 && (
                      <div className="text-xs text-ink/55">
                        {s.riskFlags.join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {flag(s.layer1Pass)}/{flag(s.layer2Pass)}/{flag(s.layer3Pass)}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink/70">
                    {s.distanceMiles != null
                      ? `${s.distanceMiles.toFixed(1)} mi`
                      : "—"}
                    {" · "}
                    {s.hoursSinceLast != null
                      ? `${s.hoursSinceLast.toFixed(1)} h`
                      : "—"}
                    {" · n="}
                    {s.scanCountAtTime}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => void toggleReport(s.id, !s.reported)}
                      className={`rounded px-2 py-1 text-xs ${
                        s.reported
                          ? "bg-accent/15 text-accent"
                          : "border border-ink/15 hover:bg-mist"
                      }`}
                    >
                      {s.reported ? "Reported" : "Mark report"}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-ink/55">
                    No scans for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "danger" | "accent";
}) {
  const color =
    tone === "ok"
      ? "text-ok"
      : tone === "danger"
        ? "text-danger"
        : tone === "accent"
          ? "text-accent"
          : "text-ink";
  return (
    <div className="border border-teal/15 bg-sand/60 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.14em] text-ink/55">{label}</p>
      <p className={`mt-1 font-[family-name:var(--font-display)] text-3xl ${color}`}>
        {value}
      </p>
    </div>
  );
}

function flag(ok: boolean) {
  return ok ? "✓" : "✗";
}
