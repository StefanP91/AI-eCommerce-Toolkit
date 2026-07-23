import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const updated = await prisma.shopPlan.updateMany({
  data: {
    plan: "free",
    subscriptionId: null,
    subscriptionStatus: "INACTIVE",
  },
});
const rows = await prisma.shopPlan.findMany({
  select: { shop: true, plan: true, subscriptionStatus: true },
});
console.log("updated", updated.count);
console.log(rows);
await prisma.$disconnect();
