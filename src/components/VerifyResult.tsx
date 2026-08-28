"use client";

import type { VerifyResponse } from "@/lib/types";

type Props = {
  result: VerifyResponse;
  onReport?: () => void;
  reporting?: boolean;
};

export function VerifyResult({ result, onReport, reporting }: Props) {
  const isFake = result.outcome === "LIKELY_FAKE";
  const needsRescan = result.outcome === "NEEDS_RESIGN";
  const notDrug = result.outcome === "NOT_A_DRUG";
  const visual = result.visual;

  const headline = notDrug
    ? "Not a medicine pack"
    : isFake
      ? "Likely Fake!!!"
      : needsRescan
        ? "Resnap required"
        : "No clear counterfeit signals";

  const tone = notDrug
    ? "border-accent/40 bg-accent/10 text-accent"
    : isFake
      ? "border-danger/40 bg-danger/10 text-danger"
      : needsRescan
        ? "border-accent/40 bg-accent/10 text-accent"
        : "border-ok/40 bg-ok/10 text-ok";

  return (
    <div className="animate-rise space-y-6">
      <div className={`rounded-lg border px-5 py-4 ${tone.split(" ").slice(0, 2).join(" ")}`}>
        <p className="text-xs uppercase tracking-[0.18em] text-ink/60">Verdict</p>
        <p
          className={`mt-1 font-[family-name:var(--font-display)] text-2xl ${tone.split(" ").slice(2).join(" ")}`}
        >
          {headline}
        </p>
        <p className="mt-2 text-sm text-ink/75">{result.note}</p>
      </div>

      {visual && (
        <div className="rounded-lg border border-teal/20 bg-mist/70 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-teal">
            What the photo shows
          </p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <Fact
              label="Medicine / drug pack?"
              value={visual.isMedicineOrDrugPackaging ? "Yes — appears so" : "No"}
            />
            <Fact
              label="Physical product?"
              value={visual.isPhysicalProduct ? "Yes" : "No / unclear"}
            />
            <Fact
              label="Observed name"
              value={visual.observedProductName || "—"}
            />
            <Fact
              label="Observed manufacturer"
              value={visual.observedManufacturer || "—"}
            />
            <Fact label="Print quality" value={visual.printQuality || "—"} />
            <Fact
              label="Packaging quality"
              value={visual.packagingQuality || "—"}
            />
            <Fact label="Logo notes" value={visual.logoNotes || "—"} />
            <Fact
              label="Visual risk"
              value={visual.visualRiskLevel ?? "—"}
            />
          </dl>

          {visual.spellingIssues.length > 0 && (
            <div className="mt-3">
              <p className="text-xs uppercase tracking-[0.14em] text-danger">
                Spelling / text issues
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm text-ink/80">
                {visual.spellingIssues.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {visual.observations.length > 0 && (
            <div className="mt-3">
              <p className="text-xs uppercase tracking-[0.14em] text-teal">
                Observations
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink/80">
                {visual.observations.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {result.product && (
        <div className="border-t border-teal/20 pt-4">
          <p className="text-xs uppercase tracking-[0.18em] text-teal">
            Registry match
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-xl">
            {result.product.name}
          </p>
          <p className="text-sm text-ink/70">
            {result.product.productId} · {result.product.batch} ·{" "}
            {result.product.manufacturer}
          </p>
        </div>
      )}

      <ol className="space-y-3">
        {result.layers.map((layer) => (
          <li key={layer.layer} className="border-l-2 border-teal/30 pl-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-[family-name:var(--font-display)] text-ink">
                Layer {layer.layer}: {layer.name}
              </p>
              <span
                className={`text-xs uppercase tracking-wider ${
                  layer.passed ? "text-ok" : "text-danger"
                }`}
              >
                {layer.passed ? "Pass" : "Flag"}
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-ink/75">
              {layer.details}
            </p>
          </li>
        ))}
      </ol>

      <div className="rounded-lg bg-mist/80 px-5 py-4">
        <p className="text-xs uppercase tracking-[0.18em] text-teal">
          AI remarks
        </p>
        <p className="mt-2 leading-relaxed text-ink">{result.aiRemark}</p>
        {result.aiRecommendations?.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink/80">
            {result.aiRecommendations.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Metric
          label="Distance (mi)"
          value={
            result.metrics.distanceMiles != null
              ? result.metrics.distanceMiles.toFixed(1)
              : "—"
          }
        />
        <Metric
          label="Hours since last"
          value={
            result.metrics.hoursSinceLast != null
              ? result.metrics.hoursSinceLast.toFixed(2)
              : "—"
          }
        />
        <Metric label="Scan count" value={String(result.metrics.scanCount)} />
        <Metric
          label="Thresholds"
          value={`X=${result.metrics.thresholds.maxMilesX} Y=${result.metrics.thresholds.minHoursY} n=${result.metrics.thresholds.maxScansN}`}
        />
      </dl>

      {(isFake || notDrug) && onReport && (
        <button
          type="button"
          disabled={reporting}
          onClick={onReport}
          className="rounded-md bg-ink px-4 py-2 text-sm text-white hover:bg-teal-deep disabled:opacity-50"
        >
          {reporting ? "Reporting…" : "Report for regulatory review"}
        </button>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink/55">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-teal/15 bg-sand/50 px-3 py-2">
      <dt className="text-xs text-ink/55">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}
