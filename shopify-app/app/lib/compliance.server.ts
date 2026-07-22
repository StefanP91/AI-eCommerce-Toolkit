import { Prisma } from "@prisma/client";
import prisma from "../db.server";
import { clearShopBillingData } from "./billing.server";

/** Delete all locally stored data for a shop (GDPR shop/redact + uninstall). */
export async function purgeShopData(shop: string) {
  await prisma.session.deleteMany({ where: { shop } }).catch(() => undefined);
  await prisma.activityRun.deleteMany({ where: { shop } }).catch(() => undefined);
  try {
    await clearShopBillingData(shop);
  } catch {
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM "ShopPlan" WHERE shop = ${shop}`,
    ).catch(() => undefined);
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM "AiUsageDaily" WHERE shop = ${shop}`,
    ).catch(() => undefined);
  }
}
