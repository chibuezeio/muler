export type Confusion = {
  tp: number;
  tn: number;
  fp: number;
  fn: number;
  n: number;
};

export type BinaryMetrics = {
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  sensitivity: number | null;
  specificity: number | null;
  fpr: number | null;
  mcc: number | null;
  auroc: number | null;
  confusion: Confusion;
};

export type Pair = {
  /** Actual positive (1) or negative (0) */
  yTrue: 0 | 1;
  /** Predicted positive (1) or negative (0) */
  yPred: 0 | 1;
  /** Score for AUROC (higher = more positive) */
  score: number;
};

function safeDiv(a: number, b: number): number | null {
  if (b === 0) return null;
  return a / b;
}

export function confusionFromPairs(pairs: Pair[]): Confusion {
  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;
  for (const p of pairs) {
    if (p.yTrue === 1 && p.yPred === 1) tp += 1;
    else if (p.yTrue === 0 && p.yPred === 0) tn += 1;
    else if (p.yTrue === 0 && p.yPred === 1) fp += 1;
    else fn += 1;
  }
  return { tp, tn, fp, fn, n: pairs.length };
}

export function computeBinaryMetrics(pairs: Pair[]): BinaryMetrics {
  const confusion = confusionFromPairs(pairs);
  const { tp, tn, fp, fn } = confusion;

  const accuracy = safeDiv(tp + tn, tp + tn + fp + fn);
  const precision = safeDiv(tp, tp + fp);
  const recall = safeDiv(tp, tp + fn);
  const sensitivity = recall;
  const specificity = safeDiv(tn, tn + fp);
  const fpr = safeDiv(fp, fp + tn);

  let f1: number | null = null;
  if (precision != null && recall != null && precision + recall > 0) {
    f1 = (2 * precision * recall) / (precision + recall);
  }

  const mccNum = tp * tn - fp * fn;
  const mccDen = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
  const mcc = mccDen === 0 ? null : mccNum / mccDen;

  const auroc = computeAuroc(pairs);

  return {
    accuracy,
    precision,
    recall,
    f1,
    sensitivity,
    specificity,
    fpr,
    mcc,
    auroc,
    confusion,
  };
}

/** Mann–Whitney / trapezoid AUROC from scores. */
export function computeAuroc(pairs: Pair[]): number | null {
  const pos = pairs.filter((p) => p.yTrue === 1).map((p) => p.score);
  const neg = pairs.filter((p) => p.yTrue === 0).map((p) => p.score);
  if (pos.length === 0 || neg.length === 0) return null;

  // Sort all unique thresholds descending
  const scored = [...pairs].sort((a, b) => b.score - a.score);
  let tp = 0;
  let fp = 0;
  const P = pos.length;
  const N = neg.length;
  let prevTpr = 0;
  let prevFpr = 0;
  let auc = 0;
  let lastScore = Number.POSITIVE_INFINITY;

  const flush = (tpr: number, fpr: number) => {
    auc += ((fpr - prevFpr) * (tpr + prevTpr)) / 2;
    prevTpr = tpr;
    prevFpr = fpr;
  };

  for (const row of scored) {
    if (row.score !== lastScore) {
      flush(tp / P, fp / N);
      lastScore = row.score;
    }
    if (row.yTrue === 1) tp += 1;
    else fp += 1;
  }
  flush(tp / P, fp / N);
  // close to (1,1) already via flush of all points
  return Math.max(0, Math.min(1, auc));
}

export function formatMetric(value: number | null, digits = 3): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}
