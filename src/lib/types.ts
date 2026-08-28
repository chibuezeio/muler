export type RiskFlag =
  | "VISUAL_INTEGRITY_FAIL"
  | "NOT_PHYSICAL_PRODUCT"
  | "NOT_MEDICINE"
  | "PACKAGING_ANOMALY"
  | "UNRECOGNIZED_PRODUCT"
  | "UNREALISTIC_LOCATION"
  | "UNREALISTIC_TIME"
  | "HIGH_SCAN_FREQUENCY";

export type VerificationOutcome =
  | "CLEARED"
  | "LIKELY_FAKE"
  | "NEEDS_RESIGN"
  | "NOT_A_DRUG";

export type VisualRiskLevel = "low" | "medium" | "high";

export interface LayerResult {
  layer: 1 | 2 | 3;
  name: string;
  passed: boolean;
  details: string;
  metrics?: Record<string, number | string | boolean | null>;
}

export interface VerifyRequest {
  decodedPayload: string;
  latitude?: number | null;
  longitude?: number | null;
  deviceId?: string;
  imageBase64?: string | null;
  mimeType?: string | null;
  visualComplete?: boolean;
  scratchedOrSqueezed?: boolean;
  skipAi?: boolean;
}

export interface AiAnalysis {
  isPhysicalProduct: boolean;
  isMedicineOrDrugPackaging: boolean;
  visualComplete: boolean;
  scratchedOrSqueezed: boolean;
  hasQrOrBarcode: boolean;
  observedProductName: string;
  observedManufacturer: string;
  spellingIssues: string[];
  printQuality: string;
  packagingQuality: string;
  logoNotes: string;
  observations: string[];
  visualRiskLevel: VisualRiskLevel;
  packagingNotes: string;
  remark: string;
  recommendations: string[];
  confidenceNote: string;
}

export interface VisualAssessment {
  isMedicineOrDrugPackaging: boolean;
  isPhysicalProduct: boolean;
  observedProductName: string | null;
  observedManufacturer: string | null;
  spellingIssues: string[];
  printQuality: string | null;
  packagingQuality: string | null;
  logoNotes: string | null;
  observations: string[];
  visualRiskLevel: VisualRiskLevel | null;
  hasQrOrBarcode: boolean;
}

export interface VerifyResponse {
  outcome: VerificationOutcome;
  riskFlags: RiskFlag[];
  layers: LayerResult[];
  product: {
    productId: string;
    name: string;
    batch: string;
    manufacturer: string;
  } | null;
  visual: VisualAssessment | null;
  metrics: {
    distanceMiles: number | null;
    hoursSinceLast: number | null;
    scanCount: number;
    thresholds: { maxMilesX: number; minHoursY: number; maxScansN: number };
  };
  aiRemark: string;
  aiRecommendations: string[];
  scanEventId: string;
  note: string;
}

export interface Thresholds {
  maxMilesX: number;
  minHoursY: number;
  maxScansN: number;
}
