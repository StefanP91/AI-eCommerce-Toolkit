export const FREE_DAILY_AI_LIMIT = 20;
export const PRO_PRICE = 19;
export const PRO_PLAN_NAME = "AI Commerce Suite Pro";

export type ShopPlanId = "free" | "pro";

export type AiAccess = {
  allowed: boolean;
  plan: ShopPlanId;
  used: number;
  limit: number | null;
  subscriptionStatus: string | null;
  code?: "quota_exceeded";
  reason?: string;
};

export const PRO_BENEFITS = [
  "Unlimited AI actions",
  "Bulk optimize & translate",
  "Priority for new tools",
] as const;
