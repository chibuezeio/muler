import { NextResponse } from "next/server";
import { ensureDatabase, ThresholdConfig } from "@/lib/db";

export const runtime = "nodejs";

async function ensureThresholds() {
  return (
    (await ThresholdConfig.findOne({ key: "default" })) ??
    (await ThresholdConfig.create({
      key: "default",
      maxMilesX: 50,
      minHoursY: 2,
      maxScansN: 25,
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
    const t = await ThresholdConfig.findOneAndUpdate(
      { key: "default" },
      {
        maxMilesX,
        minHoursY,
        maxScansN: Math.round(maxScansN),
      },
      { new: true },
    );

    if (!t) {
      return NextResponse.json({ error: "Thresholds not found" }, { status: 404 });
    }

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
