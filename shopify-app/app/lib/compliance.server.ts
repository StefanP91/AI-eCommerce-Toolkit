import prisma from "../db.server";
import { clearShopBillingData } from "./billing.server";

/** Delete all locally stored data for a shop (GDPR shop/redact + uninstall). */
export async function purgeShopData(shop: string) {
  await prisma.session.deleteMany({ where: { shop } }).catch(() => undefined);
  await prisma.activityRun.deleteMany({ where: { shop } }).catch(() => undefined);
  await clearShopBillingData(shop).catch(() => undefined);
}
