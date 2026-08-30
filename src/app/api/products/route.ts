import { NextResponse } from "next/server";
import { ensureDatabase, prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureDatabase();
    const products = await prisma.product.findMany({
      orderBy: { productId: "asc" },
      include: {
        _count: { select: { scans: true } },
      },
    });

    return NextResponse.json({
      products: products.map((p) => ({
        id: p.id,
        productId: p.productId,
        name: p.name,
        batch: p.batch,
        manufacturer: p.manufacturer,
        qrPayload: p.qrPayload,
        description: p.description,
        scanCount: p._count.scans,
      })),
    });
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
