import "dotenv/config";
import mongoose from "mongoose";
import { Product } from "../src/lib/models/Product";
import { ScanEvent } from "../src/lib/models/ScanEvent";
import { ThresholdConfig } from "../src/lib/models/ThresholdConfig";

const LAGOS = { lat: 6.5244, lng: 3.3792 };
const ABUJA = { lat: 9.0765, lng: 7.3986 };
const PH = { lat: 4.8156, lng: 7.0498 };
const IBADAN = { lat: 7.3775, lng: 3.947 };

const products = [
  {
    productId: "MUL-AML-001",
    name: "Artemether-Lumefantrine 20/120mg",
    batch: "AML-2026-A1",
    manufacturer: "GreenShield Pharma",
    qrPayload: "MULE:MUL-AML-001:AML-2026-A1",
    description: "Antimalarial combination therapy blister pack",
  },
  {
    productId: "MUL-PCM-002",
    name: "Paracetamol 500mg",
    batch: "PCM-2026-B2",
    manufacturer: "NaijaCare Labs",
    qrPayload: "MULE:MUL-PCM-002:PCM-2026-B2",
    description: "Analgesic tablet blister",
  },
  {
    productId: "MUL-AMX-003",
    name: "Amoxicillin 250mg",
    batch: "AMX-2026-C3",
    manufacturer: "DeltaMed Industries",
    qrPayload: "MULE:MUL-AMX-003:AMX-2026-C3",
    description: "Antibiotic capsules",
  },
  {
    productId: "MUL-IBU-004",
    name: "Ibuprofen 400mg",
    batch: "IBU-2026-D4",
    manufacturer: "GreenShield Pharma",
    qrPayload: "MULE:MUL-IBU-004:IBU-2026-D4",
    description: "NSAID film-coated tablets",
  },
  {
    productId: "MUL-MET-005",
    name: "Metformin 500mg",
    batch: "MET-2026-E5",
    manufacturer: "NaijaCare Labs",
    qrPayload: "MULE:MUL-MET-005:MET-2026-E5",
    description: "Oral antidiabetic tablets",
  },
  {
    productId: "MUL-CIP-006",
    name: "Ciprofloxacin 500mg",
    batch: "CIP-2026-F6",
    manufacturer: "DeltaMed Industries",
    qrPayload: "MULE:MUL-CIP-006:CIP-2026-F6",
    description: "Fluoroquinolone antibiotic",
  },
  {
    productId: "MUL-ORS-007",
    name: "ORS Sachet (WHO formula)",
    batch: "ORS-2026-G7",
    manufacturer: "AquaLife Health",
    qrPayload: "MULE:MUL-ORS-007:ORS-2026-G7",
    description: "Oral rehydration salts",
  },
  {
    productId: "MUL-ZIN-008",
    name: "Zinc Sulphate 20mg",
    batch: "ZIN-2026-H8",
    manufacturer: "AquaLife Health",
    qrPayload: "MULE:MUL-ZIN-008:ZIN-2026-H8",
    description: "Pediatric zinc dispersible tablets",
  },
  {
    productId: "MUL-AZI-009",
    name: "Azithromycin 500mg",
    batch: "AZI-2026-I9",
    manufacturer: "GreenShield Pharma",
    qrPayload: "MULE:MUL-AZI-009:AZI-2026-I9",
    description: "Macrolide antibiotic",
  },
  {
    productId: "MUL-REP-010",
    name: "Reprint Risk Demo Pack",
    batch: "REP-2026-J0",
    manufacturer: "Research Fixture Co",
    qrPayload: "MULE:MUL-REP-010:REP-2026-J0",
    description: "Seeded high-frequency scan pattern for Layer 3 evaluation",
  },
];

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");

  await mongoose.connect(uri);
  await ScanEvent.deleteMany({});
  await Product.deleteMany({});
  await ThresholdConfig.deleteMany({});

  await ThresholdConfig.create({
    key: "default",
    maxMilesX: 50,
    minHoursY: 2,
    maxScansN: 25,
  });

  const created = await Product.insertMany(products);
  const byPayload = Object.fromEntries(created.map((p) => [p.qrPayload, p]));

  const authentic = [
    { payload: "MULE:MUL-AML-001:AML-2026-A1", ...LAGOS, hours: 72, device: "seed-dev-1" },
    { payload: "MULE:MUL-AML-001:AML-2026-A1", lat: 6.53, lng: 3.38, hours: 48, device: "seed-dev-2" },
    { payload: "MULE:MUL-PCM-002:PCM-2026-B2", ...IBADAN, hours: 96, device: "seed-dev-3" },
    { payload: "MULE:MUL-PCM-002:PCM-2026-B2", lat: 7.39, lng: 3.95, hours: 24, device: "seed-dev-3" },
    { payload: "MULE:MUL-AMX-003:AMX-2026-C3", ...PH, hours: 120, device: "seed-dev-4" },
    { payload: "MULE:MUL-IBU-004:IBU-2026-D4", ...LAGOS, hours: 36, device: "seed-dev-5" },
    { payload: "MULE:MUL-MET-005:MET-2026-E5", ...ABUJA, hours: 60, device: "seed-dev-6" },
    { payload: "MULE:MUL-ORS-007:ORS-2026-G7", ...LAGOS, hours: 18, device: "seed-dev-7" },
    { payload: "MULE:MUL-ZIN-008:ZIN-2026-H8", ...IBADAN, hours: 40, device: "seed-dev-8" },
    { payload: "MULE:MUL-AZI-009:AZI-2026-I9", ...PH, hours: 80, device: "seed-dev-9" },
  ];

  for (const s of authentic) {
    const product = byPayload[s.payload];
    await ScanEvent.create({
      product: product._id,
      decodedPayload: s.payload,
      latitude: s.lat,
      longitude: s.lng,
      deviceId: s.device,
      layer1Pass: true,
      layer2Pass: true,
      layer3Pass: true,
      riskFlags: "[]",
      outcome: "CLEARED",
      aiRemark: "Seeded authentic scan — no clear signs of counterfeit activity.",
      aiRecommendations: JSON.stringify([
        "Continue routine verification before purchase.",
      ]),
      scanCountAtTime: 1,
      createdAt: hoursAgo(s.hours),
    });
  }

  const travelProduct = byPayload["MULE:MUL-CIP-006:CIP-2026-F6"];
  await ScanEvent.create({
    product: travelProduct._id,
    decodedPayload: travelProduct.qrPayload,
    latitude: LAGOS.lat,
    longitude: LAGOS.lng,
    deviceId: "seed-travel-a",
    layer1Pass: true,
    layer2Pass: true,
    layer3Pass: true,
    riskFlags: "[]",
    outcome: "CLEARED",
    aiRemark: "Seeded prior scan in Lagos.",
    scanCountAtTime: 1,
    createdAt: hoursAgo(1),
  });

  const reprint = byPayload["MULE:MUL-REP-010:REP-2026-J0"];
  for (let i = 0; i < 28; i++) {
    await ScanEvent.create({
      product: reprint._id,
      decodedPayload: reprint.qrPayload,
      latitude: LAGOS.lat + (i % 5) * 0.01,
      longitude: LAGOS.lng + (i % 3) * 0.01,
      deviceId: `seed-reprint-${i}`,
      layer1Pass: true,
      layer2Pass: true,
      layer3Pass: i < 25,
      riskFlags: i >= 25 ? '["HIGH_SCAN_FREQUENCY"]' : "[]",
      outcome: i >= 25 ? "LIKELY_FAKE" : "CLEARED",
      aiRemark:
        i >= 25
          ? "Large scan volume may imply QR/barcode reprint across multiple packs."
          : "Seeded frequency buildup scan.",
      scanCountAtTime: i + 1,
      createdAt: hoursAgo(200 - i * 4),
    });
  }

  console.log("Seed complete:");
  console.log(`  Products: ${created.length}`);
  console.log(`  Scans: ${await ScanEvent.countDocuments()}`);
  console.log(
    "  Scenarios: authentic cluster, impossible travel (CIP), high-frequency reprint (REP)",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
