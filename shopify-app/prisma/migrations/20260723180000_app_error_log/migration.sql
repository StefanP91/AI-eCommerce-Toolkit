-- CreateTable
CREATE TABLE "shopify"."AppErrorLog" (
    "id" TEXT NOT NULL,
    "shop" TEXT,
    "source" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'error',
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "path" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppErrorLog_createdAt_idx" ON "shopify"."AppErrorLog"("createdAt");

-- CreateIndex
CREATE INDEX "AppErrorLog_shop_createdAt_idx" ON "shopify"."AppErrorLog"("shop", "createdAt");
