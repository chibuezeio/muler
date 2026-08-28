import { prisma } from "@/lib/db";
import { haversineMiles, hoursBetween } from "@/lib/geo";
import { analyzeScanImage, generateAiRemarks } from "@/lib/openai";
import type {
  AiAnalysis,
  LayerResult,
  RiskFlag,
  Thresholds,
  VerificationOutcome,
  VerifyRequest,
  VerifyResponse,
  VisualAssessment,
  VisualRiskLevel,
} from "@/lib/types";

async function getThresholds(): Promise<Thresholds> {
  const row =
    (await prisma.thresholdConfig.findUnique({ where: { id: 1 } })) ??
    (await prisma.thresholdConfig.create({
      data: { id: 1, maxMilesX: 50, minHoursY: 2, maxScansN: 25 },
    }));
  return {
    maxMilesX: row.maxMilesX,
    minHoursY: row.minHoursY,
    maxScansN: row.maxScansN,
  };
}

function toVisualAssessment(
  vision: Partial<AiAnalysis> | null,
): VisualAssessment | null {
  if (!vision) return null;
  return {
    isMedicineOrDrugPackaging: Boolean(vision.isMedicineOrDrugPackaging),
    isPhysicalProduct: Boolean(vision.isPhysicalProduct),
    observedProductName: vision.observedProductName || null,
    observedManufacturer: vision.observedManufacturer || null,
    spellingIssues: vision.spellingIssues ?? [],
    printQuality: vision.printQuality || null,
    packagingQuality: vision.packagingQuality || null,
    logoNotes: vision.logoNotes || null,
    observations: vision.observations ?? [],
    visualRiskLevel: (vision.visualRiskLevel as VisualRiskLevel) || null,
    hasQrOrBarcode: Boolean(vision.hasQrOrBarcode),
  };
}

export async function runVerification(
  input: VerifyRequest,
): Promise<VerifyResponse> {
  const thresholds = await getThresholds();
  const riskFlags: RiskFlag[] = [];
  const layers: LayerResult[] = [];
  let packagingNotes = "";
  let vision: Partial<AiAnalysis> | null = null;
  let visualComplete = input.visualComplete ?? true;
  let scratchedOrSqueezed = input.scratchedOrSqueezed ?? false;
  let isPhysicalProduct = true;
  let isMedicine = true;
  let visualRiskLevel: VisualRiskLevel | null = null;
  let observations: string[] = [];

  const payload = (input.decodedPayload ?? "").trim();
  const hasImage = Boolean(input.imageBase64 && input.mimeType);

  // ——— Layer 1: Visual & physical integrity (photo-first) ———
  if (!payload && !hasImage) {
    layers.push({
      layer: 1,
      name: "Visual and Physical Integrity",
      passed: false,
      details:
        "Nothing to analyse. Snap or upload a photo of the product (and QR/barcode if present).",
    });
    return persistAndRespond({
      input,
      layers: [
        ...layers,
        {
          layer: 2,
          name: "Product Recognition and Geospatial Verification",
          passed: false,
          details: "Skipped — no image or code provided.",
        },
        {
          layer: 3,
          name: "Temporal and Frequency Analysis",
          passed: false,
          details: "Skipped — no image or code provided.",
        },
      ],
      riskFlags: ["VISUAL_INTEGRITY_FAIL"],
      layer1Pass: false,
      layer2Pass: false,
      layer3Pass: false,
      outcome: "NEEDS_RESIGN",
      product: null,
      thresholds,
      distanceMiles: null,
      hoursSinceLast: null,
      scanCount: 0,
      packagingNotes: "",
      productName: null,
      vision: null,
      observations: [],
      visualRiskLevel: null,
    });
  }

  // Always run vision when an image is present (unless skipAi)
  let visionFailedMessage: string | null = null;
  if (!input.skipAi && hasImage) {
    try {
      vision = await analyzeScanImage({
        imageBase64: input.imageBase64!,
        mimeType: input.mimeType!,
        decodedPayload: payload,
      });
      if (typeof vision.visualComplete === "boolean") {
        visualComplete = vision.visualComplete;
      }
      if (typeof vision.scratchedOrSqueezed === "boolean") {
        scratchedOrSqueezed = vision.scratchedOrSqueezed;
      }
      if (typeof vision.isPhysicalProduct === "boolean") {
        isPhysicalProduct = vision.isPhysicalProduct;
      }
      if (typeof vision.isMedicineOrDrugPackaging === "boolean") {
        isMedicine = vision.isMedicineOrDrugPackaging;
      }
      visualRiskLevel = vision.visualRiskLevel ?? null;
      observations = vision.observations ?? [];
      packagingNotes = vision.packagingNotes ?? "";
      if (vision.spellingIssues?.length) {
        observations = [
          ...observations,
          ...vision.spellingIssues.map((s) => `Spelling concern: ${s}`),
        ];
      }
    } catch (error) {
      visionFailedMessage =
        error instanceof Error
          ? error.message
          : "Vision analysis unavailable";
      packagingNotes = `Vision analysis failed: ${visionFailedMessage}`;
    }
  } else if (input.skipAi && hasImage) {
    packagingNotes = "AI vision skipped — rule/QR path only.";
  }

  // Photo was provided but AI could not read it — ask user to resnap (do not fake a clearance)
  if (hasImage && !input.skipAi && !vision) {
    layers.push({
      layer: 1,
      name: "Visual and Physical Integrity",
      passed: false,
      details:
        visionFailedMessage ||
        "Could not analyse this photo. Try a clearer, well-lit snap of the product pack.",
    });
    return persistAndRespond({
      input,
      layers: [
        ...layers,
        {
          layer: 2,
          name: "Product Recognition and Geospatial Verification",
          passed: false,
          details: "Skipped — visual AI analysis did not complete.",
        },
        {
          layer: 3,
          name: "Temporal and Frequency Analysis",
          passed: false,
          details: "Skipped — visual AI analysis did not complete.",
        },
      ],
      riskFlags: ["VISUAL_INTEGRITY_FAIL"],
      layer1Pass: false,
      layer2Pass: false,
      layer3Pass: false,
      outcome: "NEEDS_RESIGN",
      product: null,
      thresholds,
      distanceMiles: null,
      hoursSinceLast: null,
      scanCount: 0,
      packagingNotes,
      productName: null,
      vision: null,
      observations: [],
      visualRiskLevel: null,
    });
  }

  let layer1Pass = true;

  if (hasImage && vision && !isMedicine) {
    layer1Pass = false;
    riskFlags.push("NOT_MEDICINE");
    layers.push({
      layer: 1,
      name: "Visual and Physical Integrity",
      passed: false,
      details:
        packagingNotes ||
        "Photo does not appear to show medicine or drug packaging. Snap the actual product pack.",
      metrics: {
        isMedicineOrDrugPackaging: false,
        isPhysicalProduct,
        visualRiskLevel,
      },
    });
  } else if (hasImage && vision && !isPhysicalProduct) {
    layer1Pass = false;
    riskFlags.push("NOT_PHYSICAL_PRODUCT");
    layers.push({
      layer: 1,
      name: "Visual and Physical Integrity",
      passed: false,
      details:
        "Image does not appear to show a physical product pack (e.g. screen, unrelated object). Capture the pack itself.",
      metrics: { isPhysicalProduct: false, visualRiskLevel },
    });
  } else if (hasImage && (!visualComplete || scratchedOrSqueezed)) {
    // Damaged/incomplete code → ask to resnap when QR path is primary
    if (payload || vision?.hasQrOrBarcode) {
      layer1Pass = false;
      riskFlags.push("VISUAL_INTEGRITY_FAIL");
      layers.push({
        layer: 1,
        name: "Visual and Physical Integrity",
        passed: false,
        details: scratchedOrSqueezed
          ? "QR/barcode appears scratched or squeezed. Recapture a clearer image."
          : "QR/barcode visual design appears incomplete. Recapture recommended.",
        metrics: { visualComplete, scratchedOrSqueezed },
      });
    }
  }

  if (
    hasImage &&
    vision &&
    (vision.spellingIssues?.length ||
      visualRiskLevel === "high" ||
      /poor|blur|misalign|suspicious|cheap|distort/i.test(
        `${vision.printQuality} ${vision.packagingQuality} ${vision.logoNotes}`,
      ))
  ) {
    if (!riskFlags.includes("PACKAGING_ANOMALY") && isMedicine) {
      riskFlags.push("PACKAGING_ANOMALY");
    }
  }

  if (layer1Pass) {
    const observedBits = [
      vision?.observedProductName
        ? `Looks like: ${vision.observedProductName}`
        : null,
      vision?.observedManufacturer
        ? `Manufacturer text: ${vision.observedManufacturer}`
        : null,
      vision?.printQuality ? `Print: ${vision.printQuality}` : null,
      vision?.packagingQuality ? `Packaging: ${vision.packagingQuality}` : null,
      vision?.logoNotes ? `Logo: ${vision.logoNotes}` : null,
      payload ? `QR/barcode decoded.` : hasImage ? "No QR decoded — visual pack assessment used." : null,
    ]
      .filter(Boolean)
      .join(" ");

    layers.push({
      layer: 1,
      name: "Visual and Physical Integrity",
      passed: true,
      details:
        observedBits ||
        (payload
          ? "Code decoded; visual integrity cleared."
          : "Visual capture accepted."),
      metrics: {
        visualComplete,
        scratchedOrSqueezed,
        isPhysicalProduct,
        isMedicineOrDrugPackaging: isMedicine,
        visualRiskLevel,
        hasImage,
      },
    });
  }

  // Hard stops: not a drug / not physical / needs resnap for damaged code only
  if (!layer1Pass && riskFlags.includes("NOT_MEDICINE")) {
    return persistAndRespond({
      input,
      layers: [
        ...layers,
        {
          layer: 2,
          name: "Product Recognition and Geospatial Verification",
          passed: false,
          details: "Skipped — image is not medicine packaging.",
        },
        {
          layer: 3,
          name: "Temporal and Frequency Analysis",
          passed: false,
          details: "Skipped — image is not medicine packaging.",
        },
      ],
      riskFlags,
      layer1Pass: false,
      layer2Pass: false,
      layer3Pass: false,
      outcome: "NOT_A_DRUG",
      product: null,
      thresholds,
      distanceMiles: null,
      hoursSinceLast: null,
      scanCount: 0,
      packagingNotes,
      productName: vision?.observedProductName || null,
      vision,
      observations,
      visualRiskLevel,
    });
  }

  if (!layer1Pass && riskFlags.includes("VISUAL_INTEGRITY_FAIL") && !payload) {
    return persistAndRespond({
      input,
      layers: [
        ...layers,
        {
          layer: 2,
          name: "Product Recognition and Geospatial Verification",
          passed: false,
          details: "Skipped — Layer 1 needs a clearer capture.",
        },
        {
          layer: 3,
          name: "Temporal and Frequency Analysis",
          passed: false,
          details: "Skipped — Layer 1 needs a clearer capture.",
        },
      ],
      riskFlags,
      layer1Pass: false,
      layer2Pass: false,
      layer3Pass: false,
      outcome: "NEEDS_RESIGN",
      product: null,
      thresholds,
      distanceMiles: null,
      hoursSinceLast: null,
      scanCount: 0,
      packagingNotes,
      productName: vision?.observedProductName || null,
      vision,
      observations,
      visualRiskLevel,
    });
  }

  if (!layer1Pass && riskFlags.includes("NOT_PHYSICAL_PRODUCT")) {
    return persistAndRespond({
      input,
      layers: [
        ...layers,
        {
          layer: 2,
          name: "Product Recognition and Geospatial Verification",
          passed: false,
          details: "Skipped — not a physical product image.",
        },
        {
          layer: 3,
          name: "Temporal and Frequency Analysis",
          passed: false,
          details: "Skipped — not a physical product image.",
        },
      ],
      riskFlags,
      layer1Pass: false,
      layer2Pass: false,
      layer3Pass: false,
      outcome: "LIKELY_FAKE",
      product: null,
      thresholds,
      distanceMiles: null,
      hoursSinceLast: null,
      scanCount: 0,
      packagingNotes,
      productName: null,
      vision,
      observations,
      visualRiskLevel,
    });
  }

  // ——— Layer 2: Recognition + geospatial ———
  let layer2Pass = true;
  let distanceMiles: number | null = null;
  let hoursSinceLast: number | null = null;
  let product: {
    id: string;
    productId: string;
    name: string;
    batch: string;
    manufacturer: string;
  } | null = null;

  if (!payload) {
    // Photo-only path: registry lookup skipped, visual signals carry Layer 2
    if (visualRiskLevel === "high" || riskFlags.includes("PACKAGING_ANOMALY")) {
      layer2Pass = false;
      layers.push({
        layer: 2,
        name: "Product Recognition and Geospatial Verification",
        passed: false,
        details:
          "No QR/barcode decoded. Visual packaging cues suggest elevated risk — registry/geospatial checks could not confirm the unit.",
        metrics: { photoOnly: true, visualRiskLevel },
      });
    } else {
      layers.push({
        layer: 2,
        name: "Product Recognition and Geospatial Verification",
        passed: true,
        details: `No QR/barcode decoded. Visual assessment suggests medicine packaging${
          vision?.observedProductName ? ` (${vision.observedProductName})` : ""
        }. Registry match unavailable without a code — treat as partial verification.`,
        metrics: { photoOnly: true, visualRiskLevel, recognized: false },
      });
    }
  } else {
    product = await prisma.product.findUnique({
      where: { qrPayload: payload },
    });

    if (!product) {
      layer2Pass = false;
      riskFlags.push("UNRECOGNIZED_PRODUCT");
      layers.push({
        layer: 2,
        name: "Product Recognition and Geospatial Verification",
        passed: false,
        details: `Decoded payload was not recognised in the research medicine registry${
          vision?.observedProductName
            ? ` (photo looks like: ${vision.observedProductName})`
            : ""
        }.`,
        metrics: { recognized: false },
      });
    } else {
      const lastScan = await prisma.scanEvent.findFirst({
        where: { decodedPayload: payload },
        orderBy: { createdAt: "desc" },
      });

      const hasGeo =
        typeof input.latitude === "number" &&
        typeof input.longitude === "number" &&
        lastScan &&
        typeof lastScan.latitude === "number" &&
        typeof lastScan.longitude === "number";

      if (hasGeo) {
        distanceMiles = haversineMiles(
          lastScan.latitude!,
          lastScan.longitude!,
          input.latitude!,
          input.longitude!,
        );
        hoursSinceLast = hoursBetween(lastScan.createdAt, new Date());

        if (
          distanceMiles > thresholds.maxMilesX &&
          hoursSinceLast < thresholds.minHoursY
        ) {
          layer2Pass = false;
          riskFlags.push("UNREALISTIC_LOCATION");
          layers.push({
            layer: 2,
            name: "Product Recognition and Geospatial Verification",
            passed: false,
            details: `Product recognised (${product.name}), but distance ${distanceMiles.toFixed(1)} mi between present and last scan within ${hoursSinceLast.toFixed(2)} h is unrealistic (X=${thresholds.maxMilesX} mi, Y=${thresholds.minHoursY} h).`,
            metrics: {
              recognized: true,
              distanceMiles: Number(distanceMiles.toFixed(2)),
              hoursSinceLast: Number(hoursSinceLast.toFixed(2)),
            },
          });
        } else {
          layers.push({
            layer: 2,
            name: "Product Recognition and Geospatial Verification",
            passed: true,
            details: `Recognised as ${product.name}. Location within realistic range relative to prior scan.`,
            metrics: {
              recognized: true,
              distanceMiles: Number(distanceMiles.toFixed(2)),
              hoursSinceLast: Number(hoursSinceLast.toFixed(2)),
            },
          });
        }
      } else {
        layers.push({
          layer: 2,
          name: "Product Recognition and Geospatial Verification",
          passed: true,
          details: `Recognised as ${product.name}. ${
            lastScan
              ? "Insufficient geodata for distance check; recognition passed."
              : "First recorded scan for this code; geospatial baseline established."
          }`,
          metrics: { recognized: true, firstScan: !lastScan },
        });
      }
    }
  }

  // ——— Layer 3: Temporal + frequency ———
  let layer3Pass = true;
  const priorCount = payload
    ? await prisma.scanEvent.count({ where: { decodedPayload: payload } })
    : 0;
  const scanCount = payload ? priorCount + 1 : hasImage ? 1 : 0;
  const layer3Details: string[] = [];

  if (!payload) {
    layer3Details.push(
      "No unique code — scan-frequency and travel-time checks need a QR/barcode. Visual risk level used instead.",
    );
    if (visualRiskLevel === "high") {
      layer3Pass = false;
    }
  } else {
    if (
      layer2Pass &&
      distanceMiles !== null &&
      hoursSinceLast !== null &&
      distanceMiles < thresholds.maxMilesX &&
      distanceMiles >= 1 &&
      hoursSinceLast <= thresholds.minHoursY
    ) {
      layer3Pass = false;
      riskFlags.push("UNREALISTIC_TIME");
      layer3Details.push(
        `Temporal check failed: ${hoursSinceLast.toFixed(2)} h between scans ${distanceMiles.toFixed(1)} mi apart (need > Y=${thresholds.minHoursY} h when distance < X=${thresholds.maxMilesX} mi).`,
      );
    }

    if (scanCount > thresholds.maxScansN) {
      layer3Pass = false;
      if (!riskFlags.includes("HIGH_SCAN_FREQUENCY")) {
        riskFlags.push("HIGH_SCAN_FREQUENCY");
      }
      layer3Details.push(
        `Scan frequency ${scanCount} exceeds n=${thresholds.maxScansN}. Large scan volumes may imply QR/barcode reprint on multiple medications.`,
      );
    }
  }

  if (!layer2Pass) {
    layer3Details.unshift(
      "Layer 2 already flagged risk; Layer 3 metrics still recorded for research.",
    );
  }

  if (layer3Details.length === 0) {
    layer3Details.push(
      `Temporal and frequency checks within research thresholds (count=${scanCount}, n=${thresholds.maxScansN}).`,
    );
  }

  const layer3Cleared = layer3Pass && layer2Pass;

  layers.push({
    layer: 3,
    name: "Temporal and Frequency Analysis",
    passed: layer3Cleared,
    details: layer3Details.join(" "),
    metrics: {
      scanCount,
      maxScansN: thresholds.maxScansN,
      hoursSinceLast,
      distanceMiles,
      photoOnly: !payload,
    },
  });

  // High visual risk on an otherwise clear rule path still flags likely fake
  if (
    layer1Pass &&
    layer2Pass &&
    layer3Cleared &&
    visualRiskLevel === "high"
  ) {
    if (!riskFlags.includes("PACKAGING_ANOMALY")) {
      riskFlags.push("PACKAGING_ANOMALY");
    }
  }

  let outcome: VerificationOutcome =
    layer1Pass &&
    layer2Pass &&
    layer3Cleared &&
    visualRiskLevel !== "high" &&
    !riskFlags.includes("PACKAGING_ANOMALY")
      ? "CLEARED"
      : "LIKELY_FAKE";

  // Photo-only with medium risk and no hard flags → cleared with caveats via AI remark
  if (
    !payload &&
    hasImage &&
    isMedicine &&
    isPhysicalProduct &&
    visualRiskLevel === "medium" &&
    layer1Pass
  ) {
    outcome = "CLEARED";
  }

  if (
    !payload &&
    hasImage &&
    isMedicine &&
    (visualRiskLevel === "high" || riskFlags.includes("PACKAGING_ANOMALY"))
  ) {
    outcome = "LIKELY_FAKE";
  }

  return persistAndRespond({
    input,
    layers,
    riskFlags,
    layer1Pass,
    layer2Pass,
    layer3Pass: layer3Cleared,
    outcome,
    product,
    thresholds,
    distanceMiles,
    hoursSinceLast,
    scanCount,
    packagingNotes,
    productName: product?.name ?? vision?.observedProductName ?? null,
    vision,
    observations,
    visualRiskLevel,
  });
}

async function persistAndRespond(args: {
  input: VerifyRequest;
  layers: LayerResult[];
  riskFlags: RiskFlag[];
  layer1Pass: boolean;
  layer2Pass: boolean;
  layer3Pass: boolean;
  outcome: VerificationOutcome;
  product: {
    id: string;
    productId: string;
    name: string;
    batch: string;
    manufacturer: string;
  } | null;
  thresholds: Thresholds;
  distanceMiles: number | null;
  hoursSinceLast: number | null;
  scanCount: number;
  packagingNotes: string;
  productName: string | null;
  vision: Partial<AiAnalysis> | null;
  observations: string[];
  visualRiskLevel: VisualRiskLevel | null;
}): Promise<VerifyResponse> {
  const {
    input,
    layers,
    riskFlags,
    layer1Pass,
    layer2Pass,
    layer3Pass,
    outcome,
    product,
    thresholds,
    distanceMiles,
    hoursSinceLast,
    scanCount,
    packagingNotes,
    productName,
    vision,
    observations,
    visualRiskLevel,
  } = args;

  let aiRemark: string;
  let aiRecommendations: string[];

  if (input.skipAi) {
    aiRemark =
      outcome === "CLEARED"
        ? "No clear signs of counterfeit activity from rule-based layers (AI skipped)."
        : outcome === "NOT_A_DRUG"
          ? "Image does not appear to be medicine packaging (AI skipped)."
          : `Risk flags from rule-based layers: ${riskFlags.join(", ") || "none"}. More thorough verification needed (AI skipped).`;
    aiRecommendations = [
      "Enable AI analysis for packaging observations (spelling, print, logo).",
      "Escalate confirmed risks through regulatory engagement.",
    ];
  } else if (vision?.remark && outcome === "NOT_A_DRUG") {
    aiRemark = vision.remark;
    aiRecommendations =
      vision.recommendations?.length
        ? vision.recommendations
        : ["Snap a clear photo of the medicine pack and try again."];
  } else {
    const ai = await generateAiRemarks({
      layers,
      riskFlags,
      outcome,
      productName,
      observedProductName: vision?.observedProductName,
      metrics: {
        distanceMiles,
        hoursSinceLast,
        scanCount,
        maxMilesX: thresholds.maxMilesX,
        minHoursY: thresholds.minHoursY,
        maxScansN: thresholds.maxScansN,
      },
      packagingNotes,
      observations,
      visualRiskLevel,
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
    });
    aiRemark = ai.remark;
    aiRecommendations = ai.recommendations;
  }

  const visual = toVisualAssessment(vision);

  const scan = await prisma.scanEvent.create({
    data: {
      productId: product?.id,
      decodedPayload: input.decodedPayload || "(photo-only)",
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      deviceId: input.deviceId ?? null,
      imageMeta: input.mimeType
        ? JSON.stringify({
            mimeType: input.mimeType,
            hasImage: Boolean(input.imageBase64),
            packagingNotes,
            visual,
          })
        : null,
      layer1Pass,
      layer2Pass,
      layer3Pass,
      riskFlags: JSON.stringify(riskFlags),
      outcome,
      aiRemark,
      aiRecommendations: JSON.stringify(aiRecommendations),
      distanceMiles,
      hoursSinceLast,
      scanCountAtTime: scanCount,
      verificationRun: {
        create: {
          layer1Json: JSON.stringify(layers.filter((l) => l.layer === 1)),
          layer2Json: JSON.stringify(layers.filter((l) => l.layer === 2)),
          layer3Json: JSON.stringify(layers.filter((l) => l.layer === 3)),
        },
      },
    },
  });

  return {
    outcome,
    riskFlags,
    layers,
    product: product
      ? {
          productId: product.productId,
          name: product.name,
          batch: product.batch,
          manufacturer: product.manufacturer,
        }
      : null,
    visual,
    metrics: {
      distanceMiles,
      hoursSinceLast,
      scanCount,
      thresholds,
    },
    aiRemark,
    aiRecommendations,
    scanEventId: scan.id,
    note: "AI and rule outputs are advisory. Final authenticity judgment rests with the user and, where needed, regulators.",
  };
}
