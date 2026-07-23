import type { Config } from "@react-router/dev/config";

/**
 * Behind the Netlify Shopify proxy, Origin is ai-commerce-suite-shopify.netlify.app
 * while request.url host is onrender.com — RR CSRF would 400 every action.
 */
export default {
  ssr: true,
  allowedActionOrigins: [
    "ai-commerce-suite-shopify.netlify.app",
    "ai-ecommerce-shopify-app.onrender.com",
  ],
} satisfies Config;
