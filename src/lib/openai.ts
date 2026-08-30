import type {
  AiAnalysis,
  LayerResult,
  RiskFlag,
  VisualRiskLevel,
} from "@/lib/types";
import {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_MODEL,
} from "@/lib/config";

const endpoint = AZURE_OPENAI_ENDPOINT;
const model = AZURE_OPENAI_MODEL;

function extractText(data: {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  output_text?: string;
}): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }
  const message = data.output?.find((item) => item.type === "message");
  const text = message?.content?.find((c) => c.type === "output_text")?.text;
  return text?.trim() ?? "";
}

async function callResponses(input: unknown): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": AZURE_OPENAI_API_KEY,
      Authorization: `Bearer ${AZURE_OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      input,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Azure OpenAI error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return extractText(data);
}

function parseJsonBlock(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1]?.trim() ?? text.trim();
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean).slice(0, 12);
}

function asRiskLevel(value: unknown): VisualRiskLevel {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}

export async function analyzeScanImage(params: {
  imageBase64: string;
  mimeType: string;
  decodedPayload: string;
}): Promise<Partial<AiAnalysis>> {
  const dataUrl = `data:${params.mimeType};base64,${params.imageBase64}`;
  const prompt = `You are Múlẹ̀, an AI medicine authentication assistant used in research.
A user snapped or uploaded THIS photo. Decide what it is and look for authenticity cues.

Decoded QR/barcode payload (may be empty): ${params.decodedPayload || "(none)"}

Inspect carefully:
1) Is this a physical medicine / drug / pharmaceutical pack, blister, bottle, sachet, or vial label?
2) Or is it something else (phone screen, food, random object, poster, empty table)?
3) Read visible text: product name, strength, manufacturer, batch/lot, expiry if readable.
4) Spelling mistakes, odd fonts, blurry/misaligned print, cheap paper, wrong colours, logo distortion, seal/tamper issues.
5) Is a QR/barcode visible? Damaged, scratched, squeezed, incomplete?

Return ONLY valid JSON:
{
  "isPhysicalProduct": boolean,
  "isMedicineOrDrugPackaging": boolean,
  "visualComplete": boolean,
  "scratchedOrSqueezed": boolean,
  "hasQrOrBarcode": boolean,
  "observedProductName": string,
  "observedManufacturer": string,
  "spellingIssues": string[],
  "printQuality": string,
  "packagingQuality": string,
  "logoNotes": string,
  "observations": string[],
  "visualRiskLevel": "low" | "medium" | "high",
  "packagingNotes": string,
  "remark": string,
  "recommendations": string[],
  "confidenceNote": string
}

Rules:
- Be specific about what you see in the photo.
- If it is NOT a medicine/drug pack, set isMedicineOrDrugPackaging=false and explain what it appears to be.
- Prefer hedged authenticity language ("no clear signs", "more thorough verification needed"). Never claim 100% authentic or 100% fake.
- visualRiskLevel=high when packaging looks suspicious OR not a medicine; medium when uncertain; low when packaging looks consistent with a real pharma product and no obvious anomalies.
- observations: 3–8 short bullet-like strings of what you noticed.`;

  const text = await callResponses([
    {
      role: "user",
      content: [
        { type: "input_text", text: prompt },
        { type: "input_image", image_url: dataUrl },
      ],
    },
  ]);

  const parsed = parseJsonBlock(text);
  if (!parsed) {
    return {
      packagingNotes: text.slice(0, 500),
      remark:
        text.slice(0, 320) ||
        "Visual analysis completed with limited structure. More thorough verification needed.",
      recommendations: [
        "Retake a clear photo of the full medicine pack front and QR/barcode.",
        "Compare spelling, print, and logo against a known authentic unit.",
      ],
      confidenceNote: "Model returned unstructured text; treat as advisory only.",
      observations: [text.slice(0, 180)].filter(Boolean),
      visualRiskLevel: "medium",
      isPhysicalProduct: true,
      isMedicineOrDrugPackaging: false,
      visualComplete: true,
      scratchedOrSqueezed: false,
      hasQrOrBarcode: false,
      observedProductName: "",
      observedManufacturer: "",
      spellingIssues: [],
      printQuality: "unclear",
      packagingQuality: "unclear",
      logoNotes: "",
    };
  }

  return {
    isPhysicalProduct: Boolean(parsed.isPhysicalProduct),
    isMedicineOrDrugPackaging: Boolean(parsed.isMedicineOrDrugPackaging),
    visualComplete: Boolean(parsed.visualComplete ?? true),
    scratchedOrSqueezed: Boolean(parsed.scratchedOrSqueezed),
    hasQrOrBarcode: Boolean(parsed.hasQrOrBarcode),
    observedProductName: String(parsed.observedProductName ?? ""),
    observedManufacturer: String(parsed.observedManufacturer ?? ""),
    spellingIssues: asStringArray(parsed.spellingIssues),
    printQuality: String(parsed.printQuality ?? ""),
    packagingQuality: String(parsed.packagingQuality ?? ""),
    logoNotes: String(parsed.logoNotes ?? ""),
    observations: asStringArray(parsed.observations),
    visualRiskLevel: asRiskLevel(parsed.visualRiskLevel),
    packagingNotes: String(parsed.packagingNotes ?? ""),
    remark: String(parsed.remark ?? ""),
    recommendations: asStringArray(parsed.recommendations),
    confidenceNote: String(parsed.confidenceNote ?? ""),
  };
}

export async function generateAiRemarks(params: {
  layers: LayerResult[];
  riskFlags: RiskFlag[];
  outcome: string;
  productName?: string | null;
  observedProductName?: string | null;
  metrics: {
    distanceMiles: number | null;
    hoursSinceLast: number | null;
    scanCount: number;
    maxMilesX: number;
    minHoursY: number;
    maxScansN: number;
  };
  packagingNotes?: string;
  observations?: string[];
  visualRiskLevel?: VisualRiskLevel | null;
  imageBase64?: string | null;
  mimeType?: string | null;
}): Promise<{ remark: string; recommendations: string[] }> {
  const context = JSON.stringify(
    {
      outcome: params.outcome,
      riskFlags: params.riskFlags,
      layers: params.layers,
      productName: params.productName,
      observedProductName: params.observedProductName,
      metrics: params.metrics,
      packagingNotes: params.packagingNotes,
      observations: params.observations,
      visualRiskLevel: params.visualRiskLevel,
    },
    null,
    2,
  );

  const prompt = `You are Múlẹ̀ (Yoruba: "confirmed"), a research AI for counterfeit medicine risk signalling.
Write clear user-facing remarks after a photo + metadata check.

Return ONLY valid JSON:
{
  "remark": string,
  "recommendations": string[]
}

Constraints:
- Say whether the photo looks like a medicine/drug pack or not.
- Mention notable observations (spelling, print, packaging, logo) when present.
- Suggest risk; do not claim absolute authenticity or absolute counterfeit certainty.
- Use phrases like "no clear signs", "more thorough verification needed", "no obvious irregularities" where appropriate.
- Final decision rests with the user / regulator.
- Keep remark under 100 words; 2–5 short recommendations.

Audit:
${context}`;

  const content: Array<Record<string, string>> = [
    { type: "input_text", text: prompt },
  ];

  if (params.imageBase64 && params.mimeType) {
    content.push({
      type: "input_image",
      image_url: `data:${params.mimeType};base64,${params.imageBase64}`,
    });
  }

  try {
    const text = await callResponses([{ role: "user", content }]);
    const parsed = parseJsonBlock(text);
    if (parsed) {
      return {
        remark: String(parsed.remark ?? text).slice(0, 700),
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations.map(String).slice(0, 6)
          : ["Seek regulatory or pharmacist confirmation if unsure."],
      };
    }
    return {
      remark: text.slice(0, 700) || fallbackRemark(params.outcome, params.riskFlags),
      recommendations: fallbackRecommendations(params.riskFlags),
    };
  } catch {
    return {
      remark: fallbackRemark(params.outcome, params.riskFlags),
      recommendations: fallbackRecommendations(params.riskFlags),
    };
  }
}

function fallbackRemark(outcome: string, flags: RiskFlag[]): string {
  if (outcome === "NOT_A_DRUG") {
    return "This photo does not appear to show medicine or drug packaging. Snap the actual product pack for authentication.";
  }
  if (outcome === "CLEARED") {
    return "No clear signs of counterfeit activity from the checks run. Treat this as advisory support, not a final authenticity certificate.";
  }
  return `Possible risk signals were raised (${flags.join(", ") || "unspecified"}). More thorough verification is recommended before use or purchase.`;
}

function fallbackRecommendations(flags: RiskFlag[]): string[] {
  const recs = [
    "Compare packaging spelling, print quality, and logo against a known authentic unit.",
    "If risk remains, escalate to a pharmacist or regulator (e.g. NAFDAC/SON pathway).",
  ];
  if (flags.includes("NOT_MEDICINE") || flags.includes("NOT_PHYSICAL_PRODUCT")) {
    recs.unshift("Photograph the physical medicine pack (box, blister, or bottle label), not a screen or unrelated object.");
  }
  if (flags.includes("HIGH_SCAN_FREQUENCY")) {
    recs.unshift(
      "Elevated scan frequency may indicate QR/barcode reprint across multiple packs.",
    );
  }
  if (flags.includes("UNREALISTIC_LOCATION") || flags.includes("UNREALISTIC_TIME")) {
    recs.unshift(
      "Review geospatial/temporal anomalies — identical codes rarely travel unrealistic distances in short windows.",
    );
  }
  return recs;
}
