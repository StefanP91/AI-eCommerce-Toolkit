import { randomUUID } from "node:crypto";
import prisma from "../db.server";

export type AppErrorInput = {
  shop?: string | null;
  source: string;
  level?: "error" | "warn" | "info";
  message: string;
  detail?: string | null;
  path?: string | null;
};

let tableReady: Promise<void> | null = null;

/** Create AppErrorLog if migrate hasn't run yet (idempotent). */
async function ensureTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS shopify."AppErrorLog" (
          "id" TEXT NOT NULL,
          "shop" TEXT,
          "source" TEXT NOT NULL,
          "level" TEXT NOT NULL DEFAULT 'error',
          "message" TEXT NOT NULL,
          "detail" TEXT,
          "path" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "AppErrorLog_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "AppErrorLog_createdAt_idx"
        ON shopify."AppErrorLog"("createdAt")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "AppErrorLog_shop_createdAt_idx"
        ON shopify."AppErrorLog"("shop", "createdAt")
      `);
    })().catch((error) => {
      tableReady = null;
      console.error("[app-error-log] ensureTable failed", error);
      throw error;
    });
  }
  await tableReady;
}

/**
 * Persist every app/frontend failure. Always console.errors so Render logs
 * show it even if DB write fails.
 */
export async function logAppError(input: AppErrorInput) {
  const row = {
    id: randomUUID(),
    shop: input.shop || null,
    source: (input.source || "unknown").slice(0, 80),
    level: input.level || "error",
    message: (input.message || "Unknown error").slice(0, 500),
    detail: input.detail ? input.detail.slice(0, 4000) : null,
    path: input.path ? input.path.slice(0, 300) : null,
  };

  console.error(
    "[app-error-log]",
    JSON.stringify({
      ...row,
      at: new Date().toISOString(),
    }),
  );

  try {
    await ensureTable();
    await prisma.appErrorLog.create({
      data: {
        id: row.id,
        shop: row.shop,
        source: row.source,
        level: row.level,
        message: row.message,
        detail: row.detail,
        path: row.path,
      },
    });
    return row.id;
  } catch (error) {
    // Fallback raw insert (covers client/schema drift).
    try {
      await ensureTable();
      await prisma.$executeRawUnsafe(
        `INSERT INTO shopify."AppErrorLog"
          ("id","shop","source","level","message","detail","path","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
        row.id,
        row.shop,
        row.source,
        row.level,
        row.message,
        row.detail,
        row.path,
      );
      return row.id;
    } catch (rawError) {
      console.error("[app-error-log] persist failed", error, rawError);
      return null;
    }
  }
}

/** Log a failed action/result (ok:false) — use for every merchant-facing failure. */
export async function logAppFailure(input: {
  shop?: string | null;
  source: string;
  error: string;
  detail?: string | null;
  path?: string | null;
}) {
  return logAppError({
    shop: input.shop,
    source: input.source,
    level: "error",
    message: input.error,
    detail: input.detail,
    path: input.path,
  });
}

export async function listAppErrors(
  limit = 100,
  options?: { shop?: string | null },
) {
  try {
    await ensureTable();
  } catch {
    return [];
  }
  const take = Math.min(Math.max(limit, 1), 500);
  return prisma.appErrorLog.findMany({
    where: options?.shop ? { shop: options.shop } : undefined,
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Shops allowed to open /app/logs (comma-separated myshopify domains). */
export function canViewAppLogs(shop: string | null | undefined): boolean {
  const raw = process.env.LOG_VIEW_SHOPS?.trim();
  if (!raw || !shop) return false;

  const normalize = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .replace(/\.myshopify\.com$/i, "");

  const shopKey = normalize(shop);
  const allowed = raw
    .split(",")
    .map((value) => normalize(value))
    .filter(Boolean);

  // Match full domain or store slug (ai-ecommerce-suite).
  return allowed.some(
    (entry) =>
      entry === shopKey ||
      entry === `${shopKey}.myshopify.com` ||
      shop.toLowerCase() === entry ||
      shop.toLowerCase() === `${entry}.myshopify.com`,
  );
}

export function formatErrorLogsJsonl(
  rows: Array<{
    id: string;
    shop: string | null;
    source: string;
    level: string;
    message: string;
    detail: string | null;
    path: string | null;
    createdAt: Date;
  }>,
) {
  return rows
    .map((row) =>
      JSON.stringify({
        id: row.id,
        at: row.createdAt.toISOString(),
        shop: row.shop,
        source: row.source,
        level: row.level,
        message: row.message,
        detail: row.detail,
        path: row.path,
      }),
    )
    .join("\n");
}
