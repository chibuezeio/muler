import type { BinaryMetrics, Pair } from "@/lib/metrics";
import { computeBinaryMetrics } from "@/lib/metrics";

export type GroundTruth = "AUTHENTIC" | "FAKE";

export type LabeledScan = {
  _id: unknown;
  outcome: string;
  layer1Pass: boolean;
  layer2Pass: boolean;
  layer3Pass: boolean;
  groundTruth?: GroundTruth | null;
  layer1ExpectedPass?: boolean | null;
  layer2ExpectedPass?: boolean | null;
  layer3ExpectedPass?: boolean | null;
  riskFlags?: string;
};

function parseFlags(raw?: string): string[] {
  try {
    return JSON.parse(raw || "[]") as string[];
  } catch {
    return [];
  }
}

/** Higher = more counterfeit risk (for AUROC with FAKE as positive). */
export function riskScore(scan: LabeledScan): number {
  let score = 0;
  if (!scan.layer1Pass) score += 0.34;
  if (!scan.layer2Pass) score += 0.33;
  if (!scan.layer3Pass) score += 0.33;
  const flags = parseFlags(scan.riskFlags);
  if (flags.includes("HIGH_SCAN_FREQUENCY")) score = Math.min(1, score + 0.05);
  if (flags.includes("UNRECOGNIZED_PRODUCT")) score = Math.min(1, score + 0.05);
  if (scan.outcome === "LIKELY_FAKE" || scan.outcome === "NOT_A_DRUG") {
    score = Math.max(score, 0.55);
  }
  if (scan.outcome === "CLEARED") score = Math.min(score, 0.45);
  return Math.max(0, Math.min(1, score));
}

function expectedLayerPass(
  scan: LabeledScan,
  layer: 1 | 2 | 3,
): boolean | null {
  const explicit =
    layer === 1
      ? scan.layer1ExpectedPass
      : layer === 2
        ? scan.layer2ExpectedPass
        : scan.layer3ExpectedPass;
  if (typeof explicit === "boolean") return explicit;
  if (scan.groundTruth === "AUTHENTIC") return true;
  // FAKE without layer expectation: do not force all layers to fail
  return null;
}

/**
 * Product identity: positive class = AUTHENTIC.
 * Predicted authentic when system outcome is CLEARED.
 */
export function buildIdentityPairs(scans: LabeledScan[]): Pair[] {
  return scans
    .filter((s) => s.groundTruth === "AUTHENTIC" || s.groundTruth === "FAKE")
    .map((s) => {
      const yTrue: 0 | 1 = s.groundTruth === "AUTHENTIC" ? 1 : 0;
      const yPred: 0 | 1 = s.outcome === "CLEARED" ? 1 : 0;
      // identity score: inverse of counterfeit risk
      const score = 1 - riskScore(s);
      return { yTrue, yPred, score };
    });
}

/**
 * Counterfeit detection: positive class = FAKE / risk.
 * Predicted fake when outcome is not CLEARED.
 */
export function buildDetectionPairs(scans: LabeledScan[]): Pair[] {
  return scans
    .filter((s) => s.groundTruth === "AUTHENTIC" || s.groundTruth === "FAKE")
    .map((s) => {
      const yTrue: 0 | 1 = s.groundTruth === "FAKE" ? 1 : 0;
      const yPred: 0 | 1 = s.outcome === "CLEARED" ? 0 : 1;
      return { yTrue, yPred, score: riskScore(s) };
    });
}

/**
 * Per-layer: positive = layer correctly raises risk (fail).
 * yTrue = expected fail (!expectedPass), yPred = actual fail (!pass)
 */
export function buildLayerPairs(
  scans: LabeledScan[],
  layer: 1 | 2 | 3,
): Pair[] {
  const pairs: Pair[] = [];
  for (const s of scans) {
    const expectedPass = expectedLayerPass(s, layer);
    if (expectedPass == null) continue;
    const actualPass =
      layer === 1 ? s.layer1Pass : layer === 2 ? s.layer2Pass : s.layer3Pass;
    const yTrue: 0 | 1 = expectedPass ? 0 : 1; // positive = should flag risk
    const yPred: 0 | 1 = actualPass ? 0 : 1;
    const score = actualPass ? 0.15 : 0.85;
    pairs.push({ yTrue, yPred, score });
  }
  return pairs;
}

export type EvaluationBundle = {
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

export function evaluateScans(
  scans: LabeledScan[],
  unlabeledTotal: number,
): EvaluationBundle {
  const labeled = scans.filter(
    (s) => s.groundTruth === "AUTHENTIC" || s.groundTruth === "FAKE",
  );
  const identityPairs = buildIdentityPairs(labeled);
  const detectionPairs = buildDetectionPairs(labeled);
  const l1 = buildLayerPairs(labeled, 1);
  const l2 = buildLayerPairs(labeled, 2);
  const l3 = buildLayerPairs(labeled, 3);

  return {
    labeledCount: labeled.length,
    authenticCount: labeled.filter((s) => s.groundTruth === "AUTHENTIC").length,
    fakeCount: labeled.filter((s) => s.groundTruth === "FAKE").length,
    unlabeledCount: unlabeledTotal,
    productIdentity: computeBinaryMetrics(identityPairs),
    counterfeitDetection: computeBinaryMetrics(detectionPairs),
    layer1: computeBinaryMetrics(l1),
    layer2: computeBinaryMetrics(l2),
    layer3: computeBinaryMetrics(l3),
    layerSampleSizes: {
      layer1: l1.length,
      layer2: l2.length,
      layer3: l3.length,
    },
  };
}
