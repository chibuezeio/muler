import { NextResponse } from "next/server";
import { ensureDatabase, Product, ScanEvent } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureDatabase();
    const products = await Product.find().sort({ productId: 1 }).lean();

    const withCounts = await Promise.all(
      products.map(async (p) => {
        const scanCount = await ScanEvent.countDocuments({ product: p._id });
        return {
          id: String(p._id),
          productId: p.productId,
          name: p.name,
          batch: p.batch,
          manufacturer: p.manufacturer,
          qrPayload: p.qrPayload,
          description: p.description ?? null,
          scanCount,
        };
      }),
    );

    return NextResponse.json({ products: withCounts });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load products",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
