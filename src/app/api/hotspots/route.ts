import { NextResponse } from "next/server";
import { ensureDatabase, ScanEvent } from "@/lib/db";

export const runtime = "nodejs";

/** Aggregate scan points into coarse geo buckets for heatmap research views. */
export async function GET() {
  try {
    await ensureDatabase();
    const scans = await ScanEvent.find({
      latitude: { $ne: null },
      longitude: { $ne: null },
    })
      .populate("product", "name productId")
      .lean();

    const buckets = new Map<
      string,
      {
        lat: number;
        lng: number;
        total: number;
        likelyFake: number;
        cleared: number;
        products: Set<string>;
      }
    >();

    for (const s of scans) {
      if (s.latitude == null || s.longitude == null) continue;
      const lat = Math.round(s.latitude * 20) / 20;
      const lng = Math.round(s.longitude * 20) / 20;
      const key = `${lat},${lng}`;
      const bucket = buckets.get(key) ?? {
        lat,
        lng,
        total: 0,
        likelyFake: 0,
        cleared: 0,
        products: new Set<string>(),
      };
      bucket.total += 1;
      if (s.outcome === "LIKELY_FAKE") bucket.likelyFake += 1;
      if (s.outcome === "CLEARED") bucket.cleared += 1;
      const product = s.product as { productId?: string } | null;
      if (product?.productId) bucket.products.add(product.productId);
      buckets.set(key, bucket);
    }

    const hotspots = [...buckets.values()]
      .map((b) => ({
        lat: b.lat,
        lng: b.lng,
        total: b.total,
        likelyFake: b.likelyFake,
        cleared: b.cleared,
        riskRatio: b.total ? b.likelyFake / b.total : 0,
        productIds: [...b.products],
      }))
      .sort((a, b) => b.likelyFake - a.likelyFake || b.total - a.total);

    return NextResponse.json({ hotspots });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load hotspots",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
