import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { applySubscriptionWebhook } from "../lib/billing.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const subscription = (payload as {
    app_subscription?: {
      admin_graphql_api_id?: string;
      status?: string;
    };
  })?.app_subscription;

  await applySubscriptionWebhook({
    shop,
    subscriptionId: subscription?.admin_graphql_api_id || null,
    status: subscription?.status || null,
  });

  return new Response();
};
