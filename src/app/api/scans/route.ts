import { NextResponse } from "next/server";
import { ensureDatabase, ScanEvent } from "@/lib/db";

export const runtime = "nodejs";

type PopulatedProduct = {
  productId: string;
  name: string;
  batch: string;
  manufacturer: string;
};

export async function GET(request: Request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);
    const outcome = searchParams.get("outcome");
    const labeled = searchParams.get("labeled");

    const filter: Record<string, unknown> = {};
    if (outcome) filter.outcome = outcome;
    if (labeled === "1") filter.groundTruth = { $in: ["AUTHENTIC", "FAKE"] };
    if (labeled === "0") {
      filter.$or = [{ groundTruth: null }, { groundTruth: { $exists: false } }];
    }

    const scans = await ScanEvent.find(filter)
      .populate("product")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      scans: scans.map((s) => {
        const product = s.product as PopulatedProduct | null;
        return {
          id: String(s._id),
          decodedPayload: s.decodedPayload,
          latitude: s.latitude,
          longitude: s.longitude,
          deviceId: s.deviceId,
          layer1Pass: s.layer1Pass,
          layer2Pass: s.layer2Pass,
          layer3Pass: s.layer3Pass,
          riskFlags: JSON.parse(s.riskFlags || "[]"),
          outcome: s.outcome,
          aiRemark: s.aiRemark,
          aiRecommendations: JSON.parse(s.aiRecommendations || "[]"),
          distanceMiles: s.distanceMiles,
          hoursSinceLast: s.hoursSinceLast,
          scanCountAtTime: s.scanCountAtTime,
          reported: s.reported,
          createdAt: s.createdAt,
          groundTruth: s.groundTruth ?? null,
          layer1ExpectedPass: s.layer1ExpectedPass ?? null,
          layer2ExpectedPass: s.layer2ExpectedPass ?? null,
          layer3ExpectedPass: s.layer3ExpectedPass ?? null,
          evaluationNote: s.evaluationNote ?? null,
          product: product
            ? {
                productId: product.productId,
                name: product.name,
                batch: product.batch,
                manufacturer: product.manufacturer,
              }
            : null,
          layers: s.verificationRun
            ? {
                layer1: JSON.parse(s.verificationRun.layer1Json),
                layer2: JSON.parse(s.verificationRun.layer2Json),
                layer3: JSON.parse(s.verificationRun.layer3Json),
              }
            : null,
        };
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load scans",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureDatabase();
    const body = await request.json();
    const {
      id,
      reported,
      groundTruth,
      layer1ExpectedPass,
      layer2ExpectedPass,
      layer3ExpectedPass,
      evaluationNote,
    } = body as {
      id?: string;
      reported?: boolean;
      groundTruth?: "AUTHENTIC" | "FAKE" | null;
      layer1ExpectedPass?: boolean | null;
      layer2ExpectedPass?: boolean | null;
      layer3ExpectedPass?: boolean | null;
      evaluationNote?: string | null;
    };

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (typeof reported === "boolean") update.reported = reported;
    if (
      groundTruth === "AUTHENTIC" ||
      groundTruth === "FAKE" ||
      groundTruth === null
    ) {
      update.groundTruth = groundTruth;
      if (groundTruth === "AUTHENTIC") {
        if (layer1ExpectedPass === undefined) update.layer1ExpectedPass = true;
        if (layer2ExpectedPass === undefined) update.layer2ExpectedPass = true;
        if (layer3ExpectedPass === undefined) update.layer3ExpectedPass = true;
      }
    }
    if (layer1ExpectedPass !== undefined) {
      update.layer1ExpectedPass = layer1ExpectedPass;
    }
    if (layer2ExpectedPass !== undefined) {
      update.layer2ExpectedPass = layer2ExpectedPass;
    }
    if (layer3ExpectedPass !== undefined) {
      update.layer3ExpectedPass = layer3ExpectedPass;
    }
    if (evaluationNote !== undefined) update.evaluationNote = evaluationNote;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await ScanEvent.findByIdAndUpdate(id, update, { new: true });
    if (!updated) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: String(updated._id),
      reported: updated.reported,
      groundTruth: updated.groundTruth ?? null,
      layer1ExpectedPass: updated.layer1ExpectedPass ?? null,
      layer2ExpectedPass: updated.layer2ExpectedPass ?? null,
      layer3ExpectedPass: updated.layer3ExpectedPass ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Update failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
