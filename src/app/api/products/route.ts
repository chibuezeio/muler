import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
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
}
