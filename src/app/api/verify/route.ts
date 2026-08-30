import { NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/db";
import { runVerification } from "@/lib/verification/pipeline";
import type { VerifyRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const body = (await request.json()) as VerifyRequest;

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const result = await runVerification({
      decodedPayload: body.decodedPayload ?? "",
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      deviceId: body.deviceId ?? "web-client",
      imageBase64: body.imageBase64 ?? null,
      mimeType: body.mimeType ?? null,
      visualComplete: body.visualComplete,
      scratchedOrSqueezed: body.scratchedOrSqueezed,
      skipAi: body.skipAi ?? false,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("verify error", error);
    return NextResponse.json(
      {
        error: "Verification failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
