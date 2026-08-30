import { NextResponse } from "next/server";
import { ensureDatabase, prisma } from "@/lib/db";

export const runtime = "nodejs";

async function ensureThresholds() {
  return (
    (await prisma.thresholdConfig.findUnique({ where: { id: 1 } })) ??
    (await prisma.thresholdConfig.create({
      data: { id: 1, maxMilesX: 50, minHoursY: 2, maxScansN: 25 },
    }))
  );
}

export async function GET() {
  try {
    await ensureDatabase();
    const t = await ensureThresholds();
    return NextResponse.json({
      maxMilesX: t.maxMilesX,
      minHoursY: t.minHoursY,
      maxScansN: t.maxScansN,
      updatedAt: t.updatedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load thresholds",
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
    const maxMilesX = Number(body.maxMilesX);
    const minHoursY = Number(body.minHoursY);
    const maxScansN = Number(body.maxScansN);

    if (
      ![maxMilesX, minHoursY, maxScansN].every((n) => Number.isFinite(n) && n > 0)
    ) {
      return NextResponse.json(
        { error: "maxMilesX, minHoursY, maxScansN must be positive numbers" },
        { status: 400 },
      );
    }

    await ensureThresholds();
    const t = await prisma.thresholdConfig.update({
      where: { id: 1 },
      data: {
        maxMilesX,
        minHoursY,
        maxScansN: Math.round(maxScansN),
      },
    });

    return NextResponse.json({
      maxMilesX: t.maxMilesX,
      minHoursY: t.minHoursY,
      maxScansN: t.maxScansN,
      updatedAt: t.updatedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update thresholds",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
