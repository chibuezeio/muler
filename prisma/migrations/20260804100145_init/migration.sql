-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "batch" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ScanEvent" (
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

-- CreateTable
CREATE TABLE "VerificationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanEventId" TEXT NOT NULL,
    "layer1Json" TEXT NOT NULL,
    "layer2Json" TEXT NOT NULL,
    "layer3Json" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationRun_scanEventId_fkey" FOREIGN KEY ("scanEventId") REFERENCES "ScanEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ThresholdConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "maxMilesX" REAL NOT NULL DEFAULT 50,
    "minHoursY" REAL NOT NULL DEFAULT 2,
    "maxScansN" INTEGER NOT NULL DEFAULT 25,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_productId_key" ON "Product"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_qrPayload_key" ON "Product"("qrPayload");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationRun_scanEventId_key" ON "VerificationRun"("scanEventId");
