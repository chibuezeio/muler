import { NextResponse } from "next/server";
import { ensureDatabase, prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await ensureDatabase();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);
    const outcome = searchParams.get("outcome");

    const scans = await prisma.scanEvent.findMany({
      where: outcome ? { outcome } : undefined,
      include: {
        product: true,
        verificationRun: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      scans: scans.map((s) => ({
        id: s.id,
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
        product: s.product
          ? {
              productId: s.product.productId,
              name: s.product.name,
              batch: s.product.batch,
              manufacturer: s.product.manufacturer,
            }
          : null,
        layers: s.verificationRun
          ? {
              layer1: JSON.parse(s.verificationRun.layer1Json),
              layer2: JSON.parse(s.verificationRun.layer2Json),
              layer3: JSON.parse(s.verificationRun.layer3Json),
            }
          : null,
      })),
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
    const { id, reported } = body as { id?: string; reported?: boolean };
    if (!id || typeof reported !== "boolean") {
      return NextResponse.json(
        { error: "id and reported (boolean) required" },
        { status: 400 },
      );
    }
    const updated = await prisma.scanEvent.update({
      where: { id },
      data: { reported },
    });
    return NextResponse.json({ id: updated.id, reported: updated.reported });
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
