import prisma from "../db.server";

export type ActivityAction =
  | "optimize"
  | "translate"
  | "alt"
  | "collection_optimize";

export type ActivityStatus = "Success" | "Fail";

export async function logActivityRun(input: {
  shop: string;
  resource: "product" | "collection";
  resourceId: string;
  title: string;
  action: ActivityAction;
  status: ActivityStatus;
  error?: string;
}) {
  try {
    await prisma.activityRun.create({
      data: {
        shop: input.shop,
        resource: input.resource,
        resourceId: input.resourceId,
        title: input.title.slice(0, 200),
        action: input.action,
        status: input.status,
        error: input.error?.slice(0, 500) || null,
      },
    });
  } catch {
    // History is best-effort — never block the merchant action.
  }
}

export async function getTodaysActivity(shop: string, limit = 20) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  try {
    return await prisma.activityRun.findMany({
      where: {
        shop,
        createdAt: { gte: start },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

export function formatActivityTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatActivityAction(action: string): string {
  switch (action) {
    case "optimize":
      return "AI optimize";
    case "translate":
      return "Translate";
    case "alt":
      return "Image alt";
    case "collection_optimize":
      return "Collection optimize";
    default:
      return action;
  }
}
