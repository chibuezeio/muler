import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import fs from "fs";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  muleDbReady?: Promise<void>;
};

function resolveDbUrl() {
  // Vercel serverless FS is read-only except /tmp — use a writable SQLite path.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const configured = process.env.DATABASE_URL;
    if (configured?.startsWith("file:") && configured.includes("/tmp")) {
      return configured;
    }
    return "file:/tmp/muler.db";
  }

  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) return url;
  const relative = url.slice("file:".length);
  if (path.isAbsolute(relative)) return url;
  return `file:${path.join(/*turbopackIgnore: true*/ process.cwd(), relative)}`;
}

function createClient() {
  const url = resolveDbUrl();
  const filePath = url.startsWith("file:") ? url.slice("file:".length) : null;
  if (filePath) {
    const dir = path.dirname(filePath);
    if (dir && dir !== "." && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();
globalForPrisma.prisma = prisma;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "batch" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "ScanEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT,
    "decodedPayload" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "deviceId" TEXT,
    "imageMeta" TEXT,
    "layer1Pass" BOOLEAN NOT NULL DEFAULT false,
    "layer2Pass" BOOLEAN NOT NULL DEFAULT false,
    "layer3Pass" BOOLEAN NOT NULL DEFAULT false,
    "riskFlags" TEXT NOT NULL DEFAULT '[]',
    "outcome" TEXT NOT NULL,
    "aiRemark" TEXT,
    "aiRecommendations" TEXT,
    "distanceMiles" REAL,
    "hoursSinceLast" REAL,
    "scanCountAtTime" INTEGER NOT NULL DEFAULT 0,
    "reported" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScanEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "VerificationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanEventId" TEXT NOT NULL,
    "layer1Json" TEXT NOT NULL,
    "layer2Json" TEXT NOT NULL,
    "layer3Json" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationRun_scanEventId_fkey" FOREIGN KEY ("scanEventId") REFERENCES "ScanEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "ThresholdConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "maxMilesX" REAL NOT NULL DEFAULT 50,
    "minHoursY" REAL NOT NULL DEFAULT 2,
    "maxScansN" INTEGER NOT NULL DEFAULT 25,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Product_productId_key" ON "Product"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "Product_qrPayload_key" ON "Product"("qrPayload");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationRun_scanEventId_key" ON "VerificationRun"("scanEventId");
`;

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

/** Ensure schema + defaults exist (needed on Vercel where /tmp SQLite starts empty). */
export async function ensureDatabase() {
  if (!globalForPrisma.muleDbReady) {
    globalForPrisma.muleDbReady = (async () => {
      const statements = SCHEMA_SQL.split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
      }

      const thresholds = await prisma.thresholdConfig.findUnique({
        where: { id: 1 },
      });
      if (!thresholds) {
        await prisma.thresholdConfig.create({
          data: {
            id: 1,
            maxMilesX: 50,
            minHoursY: 2,
            maxScansN: 25,
            updatedAt: new Date(),
          },
        });
      }

      const productCount = await prisma.product.count();
      if (productCount === 0) {
        for (const p of SEED_PRODUCTS) {
          await prisma.product.create({ data: { ...p } });
        }
      }
    })().catch((err) => {
      globalForPrisma.muleDbReady = undefined;
      throw err;
    });
  }
  await globalForPrisma.muleDbReady;
}
