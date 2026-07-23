/**
 * Keep the Shopify app Render service warm so merchants rarely see cold starts.
 * Scheduled on Netlify every 5 minutes.
 */
const TARGET =
  process.env.SHOPIFY_APP_KEEPALIVE_URL ||
  "https://ai-ecommerce-shopify-app.onrender.com/";

export const config = {
  schedule: "*/5 * * * *",
};

export async function handler() {
  const started = Date.now();
  try {
    const response = await fetch(TARGET, {
      method: "GET",
      headers: { "User-Agent": "ai-commerce-suite-keepalive/1.0" },
      redirect: "follow",
    });
    const text = await response.text();
    const waking = /SERVICE WAKING UP|ALLOCATING COMPUTE RESOURCES/i.test(text);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: response.ok && !waking,
        status: response.status,
        waking,
        ms: Date.now() - started,
        target: TARGET,
      }),
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        ms: Date.now() - started,
        target: TARGET,
      }),
    };
  }
}
