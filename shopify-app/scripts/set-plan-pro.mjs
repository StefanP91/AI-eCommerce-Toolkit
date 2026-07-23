import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const shop = "ai-ecommerce-suite.myshopify.com";

await prisma.shopPlan.upsert({
  where: { shop },
  create: {
    shop,
    plan: "pro",
    subscriptionStatus: "ACTIVE",
    subscriptionId: "gid://shopify/AppSubscription/manual-sync",
  },
  update: {
    plan: "pro",
    subscriptionStatus: "ACTIVE",
    subscriptionId: "gid://shopify/AppSubscription/manual-sync",
  },
});

const row = await prisma.shopPlan.findUnique({
  where: { shop },
  select: { shop: true, plan: true, subscriptionId: true, subscriptionStatus: true },
});
console.log(row);
await prisma.$disconnect();
