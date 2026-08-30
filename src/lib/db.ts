import mongoose from "mongoose";
import { Product } from "@/lib/models/Product";
import { ThresholdConfig } from "@/lib/models/ThresholdConfig";

const globalForMongo = globalThis as unknown as {
  mongoosePromise?: Promise<typeof mongoose>;
  muleDbReady?: Promise<void>;
};

function getMongoUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }
  return uri;
}

export async function connectMongo() {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  if (!globalForMongo.mongoosePromise) {
    globalForMongo.mongoosePromise = mongoose.connect(getMongoUri(), {
      bufferCommands: false,
    });
  }
  try {
    await globalForMongo.mongoosePromise;
  } catch (err) {
    globalForMongo.mongoosePromise = undefined;
    throw err;
  }
  return mongoose;
}

const SEED_PRODUCTS = [
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
    productId: "MUL-REP-010",
    name: "Reprint Risk Demo Pack",
    batch: "REP-2026-J0",
    manufacturer: "Research Fixture Co",
    qrPayload: "MULE:MUL-REP-010:REP-2026-J0",
    description: "Seeded high-frequency scan pattern for Layer 3 evaluation",
  },
] as const;

/** Connect + ensure defaults exist (safe to call on every API request). */
export async function ensureDatabase() {
  if (!globalForMongo.muleDbReady) {
    globalForMongo.muleDbReady = (async () => {
      await connectMongo();

      const thresholds = await ThresholdConfig.findOne({ key: "default" });
      if (!thresholds) {
        await ThresholdConfig.create({
          key: "default",
          maxMilesX: 50,
          minHoursY: 2,
          maxScansN: 25,
        });
      }

      const productCount = await Product.countDocuments();
      if (productCount === 0) {
        await Product.insertMany([...SEED_PRODUCTS]);
      }
    })().catch((err) => {
      globalForMongo.muleDbReady = undefined;
      throw err;
    });
  }
  await globalForMongo.muleDbReady;
}

export { Product } from "@/lib/models/Product";
export { ScanEvent } from "@/lib/models/ScanEvent";
export { ThresholdConfig } from "@/lib/models/ThresholdConfig";
