import { NextResponse } from "next/server";
import { ensureDatabase, Product, ScanEvent } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Bootstrap a labeled research evaluation set from known scenarios.
 * Idempotent-ish: removes previous bootstrap device scans, then inserts labeled cases.
 */
export async function POST() {
  try {
    await ensureDatabase();

    await ScanEvent.deleteMany({ deviceId: /^eval-bootstrap-/ });

    const products = await Product.find().lean();
    const byPayload = Object.fromEntries(
      products.map((p) => [p.qrPayload, p]),
    );

    const authenticPayload =
      byPayload["MULE:MUL-AML-001:AML-2026-A1"] ?? products[0];
    const reprintPayload = byPayload["MULE:MUL-REP-010:REP-2026-J0"];
    const cipPayload = byPayload["MULE:MUL-CIP-006:CIP-2026-F6"];

    const docs = [];

    // Authentic clears — product identity positives
    for (let i = 0; i < 12; i++) {
      docs.push({
        product: authenticPayload?._id ?? null,
        decodedPayload:
          authenticPayload?.qrPayload ?? "MULE:MUL-AML-001:AML-2026-A1",
        latitude: 6.52 + i * 0.001,
        longitude: 3.37 + i * 0.001,
        deviceId: `eval-bootstrap-auth-${i}`,
        layer1Pass: true,
        layer2Pass: true,
        layer3Pass: true,
        riskFlags: "[]",
        outcome: "CLEARED",
        aiRemark: "Bootstrap authentic case.",
        scanCountAtTime: i + 1,
        groundTruth: "AUTHENTIC",
        layer1ExpectedPass: true,
        layer2ExpectedPass: true,
        layer3ExpectedPass: true,
        evaluationNote: "Seeded authentic — all layers expected to pass",
      });
    }

    // Layer 1 failures — not medicine / visual fail
    for (let i = 0; i < 8; i++) {
      docs.push({
        product: null,
        decodedPayload: "(photo-only)",
        latitude: 6.5,
        longitude: 3.3,
        deviceId: `eval-bootstrap-l1-${i}`,
        layer1Pass: false,
        layer2Pass: false,
        layer3Pass: false,
        riskFlags: '["NOT_MEDICINE"]',
        outcome: "NOT_A_DRUG",
        aiRemark: "Bootstrap Layer 1 non-medicine case.",
        scanCountAtTime: 0,
        groundTruth: "FAKE",
        layer1ExpectedPass: false,
        layer2ExpectedPass: true,
        layer3ExpectedPass: true,
        evaluationNote: "Layer 1 should flag non-medicine / visual integrity",
      });
    }

    // Layer 2 — unrecognized product
    for (let i = 0; i < 8; i++) {
      docs.push({
        product: null,
        decodedPayload: `MULE:UNKNOWN-FAKE:${i}`,
        latitude: 6.5,
        longitude: 3.3,
        deviceId: `eval-bootstrap-l2-unrec-${i}`,
        layer1Pass: true,
        layer2Pass: false,
        layer3Pass: false,
        riskFlags: '["UNRECOGNIZED_PRODUCT"]',
        outcome: "LIKELY_FAKE",
        aiRemark: "Bootstrap unrecognized code.",
        scanCountAtTime: 1,
        groundTruth: "FAKE",
        layer1ExpectedPass: true,
        layer2ExpectedPass: false,
        layer3ExpectedPass: true,
        evaluationNote: "Layer 2 should fail unrecognized registry payload",
      });
    }

    // Layer 2 — unrealistic location (CIP-like)
    for (let i = 0; i < 6; i++) {
      docs.push({
        product: cipPayload?._id ?? null,
        decodedPayload: cipPayload?.qrPayload ?? "MULE:MUL-CIP-006:CIP-2026-F6",
        latitude: 9.07,
        longitude: 7.4,
        deviceId: `eval-bootstrap-l2-geo-${i}`,
        layer1Pass: true,
        layer2Pass: false,
        layer3Pass: false,
        riskFlags: '["UNREALISTIC_LOCATION"]',
        outcome: "LIKELY_FAKE",
        aiRemark: "Bootstrap geospatial anomaly.",
        distanceMiles: 320,
        hoursSinceLast: 1,
        scanCountAtTime: 2,
        groundTruth: "FAKE",
        layer1ExpectedPass: true,
        layer2ExpectedPass: false,
        layer3ExpectedPass: true,
        evaluationNote: "Layer 2 should fail impossible travel",
      });
    }

    // Layer 3 — high frequency reprint
    for (let i = 0; i < 10; i++) {
      docs.push({
        product: reprintPayload?._id ?? null,
        decodedPayload:
          reprintPayload?.qrPayload ?? "MULE:MUL-REP-010:REP-2026-J0",
        latitude: 6.52,
        longitude: 3.38,
        deviceId: `eval-bootstrap-l3-${i}`,
        layer1Pass: true,
        layer2Pass: true,
        layer3Pass: false,
        riskFlags: '["HIGH_SCAN_FREQUENCY"]',
        outcome: "LIKELY_FAKE",
        aiRemark: "Bootstrap reprint frequency anomaly.",
        scanCountAtTime: 30 + i,
        groundTruth: "FAKE",
        layer1ExpectedPass: true,
        layer2ExpectedPass: true,
        layer3ExpectedPass: false,
        evaluationNote: "Layer 3 should fail high scan frequency",
      });
    }

    // A few hard negatives: authentic that system cleared (true identity)
    // and one intentional FP-style case for realism (authentic flagged) — optional small set
    for (let i = 0; i < 3; i++) {
      docs.push({
        product: authenticPayload?._id ?? null,
        decodedPayload:
          authenticPayload?.qrPayload ?? "MULE:MUL-AML-001:AML-2026-A1",
        latitude: 6.53,
        longitude: 3.39,
        deviceId: `eval-bootstrap-fp-${i}`,
        layer1Pass: true,
        layer2Pass: false,
        layer3Pass: true,
        riskFlags: '["UNREALISTIC_LOCATION"]',
        outcome: "LIKELY_FAKE",
        aiRemark: "Bootstrap false-positive style authentic case.",
        distanceMiles: 80,
        hoursSinceLast: 0.5,
        scanCountAtTime: 2,
        groundTruth: "AUTHENTIC",
        layer1ExpectedPass: true,
        layer2ExpectedPass: true,
        layer3ExpectedPass: true,
        evaluationNote: "Authentic unit incorrectly flagged (FP for detection)",
      });
    }

    await ScanEvent.insertMany(docs);

    return NextResponse.json({
      ok: true,
      inserted: docs.length,
      breakdown: {
        authentic: 12 + 3,
        layer1Fake: 8,
        layer2Unrecognized: 8,
        layer2Geo: 6,
        layer3Frequency: 10,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Bootstrap failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
