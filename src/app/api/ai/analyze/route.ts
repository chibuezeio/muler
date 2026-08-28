import { NextResponse } from "next/server";
import { analyzeScanImage } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageBase64, mimeType, decodedPayload } = body as {
      imageBase64?: string;
      mimeType?: string;
      decodedPayload?: string;
    };

    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        { error: "imageBase64 and mimeType are required" },
        { status: 400 },
      );
    }

    const analysis = await analyzeScanImage({
      imageBase64,
      mimeType,
      decodedPayload: decodedPayload ?? "",
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    return NextResponse.json(
      {
        error: "AI analysis failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
