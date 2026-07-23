import prisma from "../db.server";

export type AppErrorInput = {
  shop?: string | null;
  source: string;
  level?: "error" | "warn" | "info";
  message: string;
  detail?: string | null;
  path?: string | null;
};

/** Persist app/frontend errors for later pull into the repo. */
export async function logAppError(input: AppErrorInput) {
  try {
    await prisma.appErrorLog.create({
      data: {
        shop: input.shop || null,
        source: input.source.slice(0, 80),
        level: input.level || "error",
        message: input.message.slice(0, 500),
        detail: input.detail ? input.detail.slice(0, 4000) : null,
        path: input.path ? input.path.slice(0, 300) : null,
      },
    });
  } catch (error) {
    console.error("[app-error-log] failed to persist", error);
  }
}

export async function listAppErrors(
  limit = 100,
  options?: { shop?: string | null },
) {
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
  const allowed = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(shop.toLowerCase());
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
