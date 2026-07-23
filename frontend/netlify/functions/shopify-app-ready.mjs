/**
 * Server-side readiness check for the Shopify Render host.
 * Used by /shopify-app-boot so the browser never talks to Render cross-origin.
 */
const TARGET =
  process.env.SHOPIFY_APP_KEEPALIVE_URL ||
  "https://ai-ecommerce-shopify-app.onrender.com/";

export async function handler() {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const response = await fetch(TARGET, {
      method: "GET",
      headers: { "User-Agent": "ai-commerce-suite-boot-check/1.0" },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await response.text();
    const waking = /SERVICE WAKING UP|ALLOCATING COMPUTE RESOURCES|INCOMING HTTP REQUEST DETECTED/i.test(
      text,
    );
    const ready = response.ok && !waking;
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({
        ready,
        waking,
        status: response.status,
        ms: Date.now() - started,
      }),
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({
        ready: false,
        waking: true,
        error: error instanceof Error ? error.message : String(error),
        ms: Date.now() - started,
      }),
    };
  }
}
