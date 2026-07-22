import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { purgeShopData } from "../lib/compliance.server";

/**
 * Mandatory App Store compliance webhooks.
 * Topics: customers/data_request | customers/redact | shop/redact
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const normalized = String(topic).toUpperCase().replace(/\//g, "_");

  console.log(`Received compliance webhook ${topic} for ${shop}`);

  switch (normalized) {
    case "CUSTOMERS_DATA_REQUEST":
      // This app does not store customer PII from the storefront.
      // Product/catalog AI data is merchant-owned Admin API content only.
      console.log("customers/data_request acknowledged", {
        shop,
        customerId: (payload as { customer?: { id?: number } })?.customer?.id,
      });
      break;
    case "CUSTOMERS_REDACT":
      console.log("customers/redact acknowledged (no customer PII stored)", {
        shop,
        customerId: (payload as { customer?: { id?: number } })?.customer?.id,
      });
      break;
    case "SHOP_REDACT":
      await purgeShopData(shop);
      console.log("shop/redact purged local shop data", { shop });
      break;
    default:
      console.log("Unhandled compliance topic", topic);
  }

  return new Response();
};
