import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import { login } from "../../shopify.server";

/**
 * Root URL is not the merchant UI. Embedded entry goes to /app.
 * Keep a tiny fallback only for rare direct visits without shop context.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (shop) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  // Embedded admin should always include shop; if missing, send to login helper.
  if (login) {
    throw redirect(`/auth/login${url.search}`);
  }

  return {};
};

export default function AppIndex() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        background: "#070d1a",
        color: "#e8edf7",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div>
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem" }}>
          AI Commerce Suite
        </h1>
        <p style={{ margin: 0, color: "#8b9bb8", lineHeight: 1.5 }}>
          Open this app from Shopify Admin → Apps → AI Commerce Suite.
        </p>
      </div>
    </main>
  );
}
