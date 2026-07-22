-- CreateTable
CREATE TABLE "ActivityRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ActivityRun_shop_createdAt_idx" ON "ActivityRun"("shop", "createdAt");
