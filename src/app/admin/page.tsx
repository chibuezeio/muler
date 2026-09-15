"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMetric, type BinaryMetrics } from "@/lib/metrics";

type MetricsPayload = {
  generatedAt: string;
  metrics: {
    labeledCount: number;
    authenticCount: number;
    fakeCount: number;
    unlabeledCount: number;
    productIdentity: BinaryMetrics;
    counterfeitDetection: BinaryMetrics;
    layer1: BinaryMetrics;
    layer2: BinaryMetrics;
    layer3: BinaryMetrics;
    layerSampleSizes: { layer1: number; layer2: number; layer3: number };
  };
  definitions: {
    productIdentity: string;
    counterfeitDetection: string;
    layers: string;
  };
};

type LabelRow = {
  id: string;
  outcome: string;
  groundTruth: "AUTHENTIC" | "FAKE" | null;
  layer1Pass: boolean;
  layer2Pass: boolean;
  layer3Pass: boolean;
  decodedPayload: string;
  product: { name: string; productId: string } | null;
  evaluationNote: string | null;
  createdAt: string;
};

const METRIC_ROWS: {
  key: Exclude<keyof BinaryMetrics, "confusion">;
  label: string;
}[] = [
  { key: "accuracy", label: "Accuracy" },
  { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall" },
  { key: "f1", label: "F1" },
  { key: "sensitivity", label: "Sensitivity" },
  { key: "specificity", label: "Specificity" },
  { key: "fpr", label: "FPR" },
  { key: "mcc", label: "MCC" },
  { key: "auroc", label: "AUROC" },
];

export default function AdminPage() {
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [rows, setRows] = useState<LabelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, scansRes] = await Promise.all([
        fetch("/api/admin/metrics"),
        fetch("/api/scans?limit=80"),
      ]);
      const metricsJson = await metricsRes.json();
      const scansJson = await scansRes.json();
      if (!metricsRes.ok) {
        throw new Error(metricsJson.detail || metricsJson.error || "Metrics failed");
      }
      setData(metricsJson);
      setRows(
        (scansJson.scans ?? []).map(
          (s: LabelRow & { createdAt: string }) => ({
            id: s.id,
            outcome: s.outcome,
            groundTruth: s.groundTruth ?? null,
            layer1Pass: s.layer1Pass,
            layer2Pass: s.layer2Pass,
            layer3Pass: s.layer3Pass,
            decodedPayload: s.decodedPayload,
            product: s.product,
            evaluationNote: s.evaluationNote ?? null,
            createdAt: s.createdAt,
          }),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function bootstrap() {
    setBootstrapping(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/evaluation/bootstrap", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || json.error || "Bootstrap failed");
      setMessage(`Loaded ${json.inserted} labeled evaluation cases.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bootstrap failed");
    } finally {
      setBootstrapping(false);
    }
  }

  async function setLabel(id: string, groundTruth: "AUTHENTIC" | "FAKE" | null) {
    await fetch("/api/scans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, groundTruth }),
    });
    await load();
  }

  const m = data?.metrics;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-teal">Admin</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl text-ink">
            Evaluation dashboard
          </h1>
          <p className="mt-3 text-ink/75 leading-relaxed">
            Research metrics for product identity and counterfeit detection across
            Layers 1–3: accuracy, precision, recall, F1, sensitivity, specificity,
            FPR, MCC, and AUROC.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={bootstrapping}
            onClick={() => void bootstrap()}
            className="rounded-md bg-teal px-4 py-2 text-sm text-white hover:bg-teal-deep disabled:opacity-50"
          >
            {bootstrapping ? "Bootstrapping…" : "Bootstrap labeled set"}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-ink/20 px-4 py-2 text-sm hover:bg-mist"
          >
            Refresh
          </button>
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-md border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {loading && !data && (
        <p className="mt-10 text-ink/60">Computing evaluation metrics…</p>
      )}

      {m && (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            <Stat label="Labeled cases" value={m.labeledCount} />
            <Stat label="Authentic (GT)" value={m.authenticCount} tone="ok" />
            <Stat label="Fake (GT)" value={m.fakeCount} tone="danger" />
            <Stat label="Unlabeled scans" value={m.unlabeledCount} />
          </div>

          <section className="mt-12">
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink">
              Product identity
            </h2>
            <p className="mt-1 text-sm text-ink/65">
              {data?.definitions.productIdentity}
            </p>
            <MetricsTable metrics={m.productIdentity} />
          </section>

          <section className="mt-12">
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink">
              Counterfeit detection
            </h2>
            <p className="mt-1 text-sm text-ink/65">
              {data?.definitions.counterfeitDetection}
            </p>
            <MetricsTable metrics={m.counterfeitDetection} />
          </section>

          <section className="mt-12">
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink">
              Layer-wise performance
            </h2>
            <p className="mt-1 mb-6 text-sm text-ink/65">
              {data?.definitions.layers}
            </p>
            <div className="grid gap-6 lg:grid-cols-3">
              <LayerCard
                title="Layer 1 — Visual integrity"
                n={m.layerSampleSizes.layer1}
                metrics={m.layer1}
              />
              <LayerCard
                title="Layer 2 — Recognition / geo"
                n={m.layerSampleSizes.layer2}
                metrics={m.layer2}
              />
              <LayerCard
                title="Layer 3 — Time / frequency"
                n={m.layerSampleSizes.layer3}
                metrics={m.layer3}
              />
            </div>
          </section>

          <section className="mt-12 overflow-x-auto">
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink">
              Confusion summaries
            </h2>
            <table className="mt-4 min-w-full text-left text-sm">
              <thead className="bg-ink text-mist">
                <tr>
                  <th className="px-3 py-2 font-normal">Task</th>
                  <th className="px-3 py-2 font-normal">TP</th>
                  <th className="px-3 py-2 font-normal">TN</th>
                  <th className="px-3 py-2 font-normal">FP</th>
                  <th className="px-3 py-2 font-normal">FN</th>
                  <th className="px-3 py-2 font-normal">N</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Product identity", m.productIdentity],
                    ["Counterfeit detection", m.counterfeitDetection],
                    ["Layer 1", m.layer1],
                    ["Layer 2", m.layer2],
                    ["Layer 3", m.layer3],
                  ] as const
                ).map(([label, metrics]) => (
                  <tr key={label} className="border-t border-teal/10 odd:bg-white/40">
                    <td className="px-3 py-2">{label}</td>
                    <td className="px-3 py-2">{metrics.confusion.tp}</td>
                    <td className="px-3 py-2">{metrics.confusion.tn}</td>
                    <td className="px-3 py-2">{metrics.confusion.fp}</td>
                    <td className="px-3 py-2">{metrics.confusion.fn}</td>
                    <td className="px-3 py-2">{metrics.confusion.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data?.generatedAt && (
              <p className="mt-2 text-xs text-ink/50">
                Generated {new Date(data.generatedAt).toLocaleString()}
              </p>
            )}
          </section>
        </>
      )}

      <section className="mt-14">
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-ink">
          Label scans for evaluation
        </h2>
        <p className="mt-1 mb-4 text-sm text-ink/65">
          Assign ground truth to live scans so metrics update. AUTHENTIC defaults
          all layers to expected pass.
        </p>
        <div className="overflow-x-auto border border-teal/15">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-ink text-mist">
              <tr>
                <th className="px-3 py-2 font-normal">When</th>
                <th className="px-3 py-2 font-normal">Product / payload</th>
                <th className="px-3 py-2 font-normal">Outcome</th>
                <th className="px-3 py-2 font-normal">L1/L2/L3</th>
                <th className="px-3 py-2 font-normal">Ground truth</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-teal/10 odd:bg-white/40">
                  <td className="px-3 py-2 whitespace-nowrap text-ink/70">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {r.product?.name ?? "Unrecognised / photo"}
                    </div>
                    <div className="max-w-[220px] truncate text-xs text-ink/55">
                      {r.decodedPayload}
                    </div>
                  </td>
                  <td className="px-3 py-2">{r.outcome}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.layer1Pass ? "✓" : "✗"}/{r.layer2Pass ? "✓" : "✗"}/
                    {r.layer3Pass ? "✓" : "✗"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => void setLabel(r.id, "AUTHENTIC")}
                        className={`rounded px-2 py-1 text-xs ${
                          r.groundTruth === "AUTHENTIC"
                            ? "bg-ok/20 text-ok"
                            : "border border-ink/15 hover:bg-mist"
                        }`}
                      >
                        Authentic
                      </button>
                      <button
                        type="button"
                        onClick={() => void setLabel(r.id, "FAKE")}
                        className={`rounded px-2 py-1 text-xs ${
                          r.groundTruth === "FAKE"
                            ? "bg-danger/15 text-danger"
                            : "border border-ink/15 hover:bg-mist"
                        }`}
                      >
                        Fake
                      </button>
                      <button
                        type="button"
                        onClick={() => void setLabel(r.id, null)}
                        className="rounded border border-ink/15 px-2 py-1 text-xs hover:bg-mist"
                      >
                        Clear
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-ink/55">
                    No scans yet. Bootstrap a labeled set or run verifies first.
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
  tone?: "ok" | "danger";
}) {
  const color =
    tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : "text-ink";
  return (
    <div className="border border-teal/15 bg-sand/60 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.14em] text-ink/55">{label}</p>
      <p className={`mt-1 font-[family-name:var(--font-display)] text-3xl ${color}`}>
        {value}
      </p>
    </div>
  );
}

function MetricsTable({ metrics }: { metrics: BinaryMetrics }) {
  return (
    <div className="mt-4 overflow-x-auto border border-teal/15">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-mist/80">
          <tr>
            {METRIC_ROWS.map((r) => (
              <th key={r.key} className="px-3 py-2 font-normal text-ink/70">
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {METRIC_ROWS.map((r) => {
              const num = metrics[r.key];
              return (
                <td key={r.key} className="px-3 py-3 font-[family-name:var(--font-display)] text-lg text-ink">
                  {formatMetric(num)}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function LayerCard({
  title,
  n,
  metrics,
}: {
  title: string;
  n: number;
  metrics: BinaryMetrics;
}) {
  return (
    <div className="border border-teal/20 bg-mist/40 p-4">
      <h3 className="font-[family-name:var(--font-display)] text-lg text-ink">
        {title}
      </h3>
      <p className="text-xs text-ink/55">n = {n} labeled layer cases</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {METRIC_ROWS.map((r) => {
          const num = metrics[r.key];
          return (
            <div key={r.key}>
              <dt className="text-ink/55">{r.label}</dt>
              <dd className="font-medium text-ink">{formatMetric(num)}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
