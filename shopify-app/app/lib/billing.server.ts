import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import prisma from "../db.server";
import {
  FREE_DAILY_AI_LIMIT,
  PRO_PLAN_NAME,
  PRO_PRICE,
  type AiAccess,
  type ShopPlanId,
} from "./billing";

export {
  FREE_DAILY_AI_LIMIT,
  PRO_PLAN_NAME,
  PRO_PRICE,
  type AiAccess,
  type ShopPlanId,
} from "./billing";

type ShopPlanRow = {
  shop: string;
  plan: string;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
};

type ShopifyAdmin = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

export function useTestCharges(): boolean {
  if (process.env.BILLING_TEST_CHARGES === "0") return false;
  if (process.env.BILLING_TEST_CHARGES === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export function useDevBillingBypass(): boolean {
  // Never allow billing bypass in production — App Store / live shops must use Billing API.
  if (process.env.NODE_ENV === "production") return false;
  const raw = (process.env.BILLING_DEV_BYPASS || "").trim();
  return raw === "1" || raw.toLowerCase() === "true";
}

const PUBLIC_DISTRIBUTION_HELP =
  process.env.NODE_ENV === "production"
    ? "Billing is temporarily unavailable. Please try again later or contact support."
    : "Shopify Billing needs Public distribution. In Partner Dashboard → your app → Distribution, choose Public (Draft is fine — no App Store listing required). Or set BILLING_DEV_BYPASS=1 in shopify-app/.env to simulate Pro locally.";

function friendlyBillingError(message: string): string {
  if (/public distribution/i.test(message) || /custom apps? cannot use billing/i.test(message)) {
    return PUBLIC_DISTRIBUTION_HELP;
  }
  return message;
}

/**
 * Billing tables are accessed via raw SQL so Settings keeps working even when a
 * stale Vite/Prisma client is missing the generated `shopPlan` delegates.
 */
export async function getShopBilling(shop: string): Promise<ShopPlanRow> {
  const rows = await prisma.$queryRaw<ShopPlanRow[]>(
    Prisma.sql`SELECT shop, plan, subscriptionId, subscriptionStatus, trialEndsAt
      FROM "shopify"."ShopPlan" WHERE shop = ${shop} LIMIT 1`,
  );
  if (rows[0]) return rows[0];

  const stamp = nowIso();
  await prisma.$executeRaw(
    Prisma.sql`INSERT INTO "shopify"."ShopPlan"
      (shop, plan, subscriptionId, subscriptionStatus, trialEndsAt, createdAt, updatedAt)
      VALUES (${shop}, 'free', NULL, NULL, NULL, ${stamp}, ${stamp})`,
  );

  return {
    shop,
    plan: "free",
    subscriptionId: null,
    subscriptionStatus: null,
    trialEndsAt: null,
  };
}

async function upsertShopPlan(input: {
  shop: string;
  plan: string;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
}) {
  const stamp = nowIso();
  await prisma.$executeRaw(
    Prisma.sql`INSERT INTO "shopify"."ShopPlan"
      (shop, plan, subscriptionId, subscriptionStatus, trialEndsAt, createdAt, updatedAt)
      VALUES (
        ${input.shop},
        ${input.plan},
        ${input.subscriptionId ?? null},
        ${input.subscriptionStatus ?? null},
        NULL,
        ${stamp},
        ${stamp}
      )
      ON CONFLICT(shop) DO UPDATE SET
        plan = excluded.plan,
        subscriptionId = excluded.subscriptionId,
        subscriptionStatus = excluded.subscriptionStatus,
        updatedAt = excluded.updatedAt`,
  );

  return getShopBilling(input.shop);
}

export async function getDailyUsage(shop: string, day = todayKey()) {
  const rows = await prisma.$queryRaw<Array<{ count: number | bigint }>>(
    Prisma.sql`SELECT count FROM "shopify"."AiUsageDaily" WHERE shop = ${shop} AND day = ${day} LIMIT 1`,
  );
  const value = rows[0]?.count ?? 0;
  return typeof value === "bigint" ? Number(value) : value;
}

export async function incrementDailyUsage(
  shop: string,
  amount = 1,
  day = todayKey(),
) {
  const stamp = nowIso();
  const id = randomUUID();
  await prisma.$executeRaw(
    Prisma.sql`INSERT INTO "shopify"."AiUsageDaily" (id, shop, day, count, createdAt, updatedAt)
      VALUES (${id}, ${shop}, ${day}, ${amount}, ${stamp}, ${stamp})
      ON CONFLICT(shop, day) DO UPDATE SET
        count = "shopify"."AiUsageDaily".count + ${amount},
        updatedAt = ${stamp}`,
  );
}

export async function canUseAi(shop: string): Promise<AiAccess> {
  const billing = await getShopBilling(shop);
  const plan = (billing.plan === "pro" ? "pro" : "free") as ShopPlanId;
  const used = await getDailyUsage(shop);

  if (plan === "pro") {
    return {
      allowed: true,
      plan,
      used,
      limit: null,
      subscriptionStatus: billing.subscriptionStatus,
    };
  }

  if (used >= FREE_DAILY_AI_LIMIT) {
    return {
      allowed: false,
      plan: "free",
      used,
      limit: FREE_DAILY_AI_LIMIT,
      subscriptionStatus: billing.subscriptionStatus,
      code: "quota_exceeded",
      reason: `Daily free limit reached (${used}/${FREE_DAILY_AI_LIMIT}). Upgrade to Pro for unlimited AI.`,
    };
  }

  return {
    allowed: true,
    plan: "free",
    used,
    limit: FREE_DAILY_AI_LIMIT,
    subscriptionStatus: billing.subscriptionStatus,
  };
}

export function quotaExceededPayload(access: AiAccess) {
  return {
    ok: false as const,
    error:
      access.reason ||
      `Daily free limit reached (${access.used}/${access.limit ?? FREE_DAILY_AI_LIMIT}). Upgrade to Pro for unlimited AI.`,
    code: "quota_exceeded" as const,
    used: access.used,
    limit: access.limit ?? FREE_DAILY_AI_LIMIT,
  };
}

export async function consumeAiAction(shop: string | undefined) {
  if (!shop) return { ok: true as const };
  const access = await canUseAi(shop);
  if (!access.allowed) {
    return quotaExceededPayload(access);
  }
  if (access.plan === "free") {
    await incrementDailyUsage(shop);
  }
  return { ok: true as const, access };
}

export async function requireAiAccess(shop: string | undefined) {
  if (!shop) {
    return { allowed: true as const } as const;
  }
  const access = await canUseAi(shop);
  if (!access.allowed) {
    return { allowed: false as const, deny: quotaExceededPayload(access) };
  }
  return { allowed: true as const, access };
}

export async function requireProPlan(shop: string | undefined) {
  if (!shop) {
    return { allowed: true as const } as const;
  }
  const access = await canUseAi(shop);
  if (access.plan === "pro") {
    return { allowed: true as const, access };
  }
  return {
    allowed: false as const,
    deny: {
      ok: false as const,
      error: "Bulk actions are a Pro feature. Upgrade in Settings to unlock.",
      code: "upgrade_required" as const,
      used: access.used,
      limit: access.limit ?? FREE_DAILY_AI_LIMIT,
    },
  };
}

export async function recordAiUsageIfFree(shop: string | undefined) {
  if (!shop) return;
  const billing = await getShopBilling(shop);
  if (billing.plan !== "pro") {
    await incrementDailyUsage(shop);
  }
}

export async function buildBillingReturnUrl(
  admin: ShopifyAdmin,
  shop: string,
  appPath = "/app/settings",
) {
  const path = appPath.startsWith("/") ? appPath : `/${appPath}`;

  try {
    const response = await admin.graphql(
      `#graphql
        query BillingReturnLaunchUrl {
          currentAppInstallation {
            launchUrl
          }
        }`,
    );
    const json = await response.json();
    const launchUrl = String(
      json.data?.currentAppInstallation?.launchUrl || "",
    ).replace(/\/$/, "");

    // Must return into Shopify Admin embed — tunnel-only URLs show a blank page.
    if (launchUrl.includes("admin.shopify.com")) {
      return `${launchUrl}${path}?billing=1`;
    }
  } catch {
    // fall through to constructed Admin URL
  }

  const store = shop.replace(/\.myshopify\.com$/i, "");
  const apiKey = process.env.SHOPIFY_API_KEY?.trim() || "";
  return `https://admin.shopify.com/store/${store}/apps/${apiKey}${path}?billing=1`;
}

export async function createProSubscription(
  admin: ShopifyAdmin,
  shop: string,
  returnUrl: string,
): Promise<{
  confirmationUrl: string;
  subscriptionId: string;
  usedDevBypass: boolean;
}> {
  // Always use Shopify Billing API for Upgrade.
  // BILLING_DEV_BYPASS only enables the Settings Free/Pro toggle — it must not skip checkout.

  const response = await admin.graphql(
    `#graphql
      mutation CreateProSubscription(
        $name: String!
        $returnUrl: URL!
        $test: Boolean
        $lineItems: [AppSubscriptionLineItemInput!]!
      ) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          test: $test
          lineItems: $lineItems
          trialDays: 0
        ) {
          confirmationUrl
          appSubscription {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        name: PRO_PLAN_NAME,
        returnUrl,
        test: useTestCharges(),
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: {
                  amount: PRO_PRICE,
                  currencyCode: "USD",
                },
                interval: "EVERY_30_DAYS",
              },
            },
          },
        ],
      },
    },
  );

  const json = await response.json();
  const topErrors = Array.isArray(json.errors)
    ? json.errors.map((e: { message?: string }) => e.message || "Billing error")
    : [];
  if (topErrors.length) {
    throw new Error(friendlyBillingError(topErrors.join(", ")));
  }

  const payload = json.data?.appSubscriptionCreate;
  const errors = payload?.userErrors || [];
  if (errors.length) {
    throw new Error(
      friendlyBillingError(
        errors.map((e: { message: string }) => e.message).join(", "),
      ),
    );
  }

  const confirmationUrl = payload?.confirmationUrl as string | undefined;
  const subscriptionId = payload?.appSubscription?.id as string | undefined;
  if (!confirmationUrl || !subscriptionId) {
    throw new Error("Shopify did not return a billing confirmation URL");
  }

  await upsertShopPlan({
    shop,
    plan: "free",
    subscriptionId,
    subscriptionStatus: "PENDING",
  });

  return { confirmationUrl, subscriptionId, usedDevBypass: false };
}

export async function syncSubscriptionFromShopify(
  admin: ShopifyAdmin,
  shop: string,
) {
  // Local bypass: plan is controlled in Settings (dev toggle), not Shopify Billing.
  if (useDevBillingBypass()) {
    return getShopBilling(shop);
  }

  const response = await admin.graphql(
    `#graphql
      query CurrentAppSubscriptions {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            test
          }
        }
      }`,
  );
  const json = await response.json();
  const subscriptions =
    json.data?.currentAppInstallation?.activeSubscriptions || [];

  const pro = subscriptions.find(
    (sub: { name?: string; status?: string }) =>
      sub.name === PRO_PLAN_NAME && sub.status === "ACTIVE",
  );

  if (pro) {
    return upsertShopPlan({
      shop,
      plan: "pro",
      subscriptionId: pro.id,
      subscriptionStatus: "ACTIVE",
    });
  }

  const billing = await getShopBilling(shop);
  return upsertShopPlan({
    shop,
    plan: "free",
    subscriptionId: billing.subscriptionId,
    subscriptionStatus:
      billing.subscriptionStatus === "PENDING"
        ? "PENDING"
        : billing.subscriptionStatus || "INACTIVE",
  });
}

/** Local-only Free/Pro switch (requires BILLING_DEV_BYPASS=1, never in production). */
export async function setDevPlan(shop: string, plan: ShopPlanId) {
  if (!useDevBillingBypass()) {
    throw new Error("Dev plan switch is only available with BILLING_DEV_BYPASS=1");
  }
  const next = plan === "pro" ? "pro" : "free";
  return upsertShopPlan({
    shop,
    plan: next,
    subscriptionId:
      next === "pro" ? `gid://shopify/AppSubscription/dev-${shop}` : null,
    subscriptionStatus: next === "pro" ? "ACTIVE" : "INACTIVE",
  });
}

export async function applySubscriptionWebhook(input: {
  shop: string;
  subscriptionId?: string | null;
  status?: string | null;
}) {
  const status = (input.status || "").toUpperCase();
  const isActive = status === "ACTIVE";

  await upsertShopPlan({
    shop: input.shop,
    plan: isActive ? "pro" : "free",
    subscriptionId: input.subscriptionId || null,
    subscriptionStatus: status || null,
  });
}

export async function clearShopBillingData(shop: string) {
  await prisma.$executeRaw(
    Prisma.sql`DELETE FROM "shopify"."ShopPlan" WHERE shop = ${shop}`,
  );
  await prisma.$executeRaw(
    Prisma.sql`DELETE FROM "shopify"."AiUsageDaily" WHERE shop = ${shop}`,
  );
}

export function planSummary(access: AiAccess) {
  if (access.plan === "pro") {
    return {
      name: "Pro",
      priceLabel: `$${PRO_PRICE}/mo`,
      usageLabel: "Unlimited AI actions",
      features: [
        "Unlimited AI generations",
        "Bulk optimize products & collections",
        "Product Optimize, Translate, SEO tools",
        "Image Optimizer & Collections",
      ],
    };
  }

  return {
    name: "Free",
    priceLabel: "$0",
    usageLabel: `${access.used}/${access.limit ?? FREE_DAILY_AI_LIMIT} AI actions today`,
    features: [
      `${FREE_DAILY_AI_LIMIT} AI actions per day`,
      "Browse products & collections",
      "Schema JSON-LD (unlimited)",
      "Bulk optimize requires Pro",
    ],
  };
}
