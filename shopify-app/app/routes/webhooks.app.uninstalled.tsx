import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { purgeShopData } from "../lib/compliance.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // Always attempt shop-scoped purge; ignore if tables are already empty.
  if (session || shop) {
    await purgeShopData(shop).catch((error) => {
      console.error("Failed to purge shop data on uninstall", { shop, error });
    });
  }

  return new Response();
};
