import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/** Aggregate scan points into coarse geo buckets for heatmap research views. */
export async function GET() {
  const scans = await prisma.scanEvent.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      latitude: true,
      longitude: true,
      outcome: true,
      riskFlags: true,
      product: { select: { name: true, productId: true } },
    },
  });

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
    if (s.product?.productId) bucket.products.add(s.product.productId);
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
}
