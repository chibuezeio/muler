import { NextResponse } from "next/server";
import { ensureDatabase, ScanEvent } from "@/lib/db";
import { evaluateScans, type LabeledScan } from "@/lib/evaluation";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureDatabase();
    const [labeled, unlabeledCount] = await Promise.all([
      ScanEvent.find({
        groundTruth: { $in: ["AUTHENTIC", "FAKE"] },
      })
        .select(
          "outcome layer1Pass layer2Pass layer3Pass groundTruth layer1ExpectedPass layer2ExpectedPass layer3ExpectedPass riskFlags",
        )
        .lean(),
      ScanEvent.countDocuments({
        $or: [{ groundTruth: null }, { groundTruth: { $exists: false } }],
      }),
    ]);

    const metrics = evaluateScans(labeled as LabeledScan[], unlabeledCount);
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      metrics,
      definitions: {
        productIdentity:
          "Positive class = AUTHENTIC. Predicted positive when outcome is CLEARED.",
        counterfeitDetection:
          "Positive class = FAKE. Predicted positive when outcome is not CLEARED.",
        layers:
          "Positive class = risk flag (layer fail). Compared against per-layer expected pass/fail.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to compute metrics",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
