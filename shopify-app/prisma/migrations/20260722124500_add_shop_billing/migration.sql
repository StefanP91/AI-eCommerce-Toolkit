-- CreateTable
CREATE TABLE "ShopPlan" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "subscriptionId" TEXT,
    "subscriptionStatus" TEXT,
    "trialEndsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiUsageDaily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AiUsageDaily_shop_day_idx" ON "AiUsageDaily"("shop", "day");

-- CreateIndex
CREATE UNIQUE INDEX "AiUsageDaily_shop_day_key" ON "AiUsageDaily"("shop", "day");
