import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

/**
 * Fallback if Billing ever returns outside Admin.
 * Prefer buildBillingReturnUrl() which uses admin.shopify.com directly.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const chargeId = url.searchParams.get("charge_id");
  const apiKey = process.env.SHOPIFY_API_KEY?.trim() || "";

  if (!shop || !apiKey) {
    return new Response(
      `<!doctype html><html><body style="font-family:system-ui;padding:2rem">
        <h1>Subscription approved</h1>
        <p>Open <strong>Shopify Admin → Apps → AI Commerce Suite → Settings</strong>
        and click <em>Refresh plan status</em>.</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const store = shop.replace(/\.myshopify\.com$/i, "");
  const target = new URL(
    `https://admin.shopify.com/store/${store}/apps/${apiKey}/app/settings`,
  );
  target.searchParams.set("billing", "1");
  if (chargeId) target.searchParams.set("charge_id", chargeId);
  return redirect(target.toString());
};

export default function BillingReturnFallback() {
  return null;
}
