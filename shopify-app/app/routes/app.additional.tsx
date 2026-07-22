import type { HeadersFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

export default function SettingsPage() {
  return (
    <>
      <div className="dashboard-topbar">
        <div>
          <h1>Settings</h1>
          <p>AI Commerce Suite runs inside your Shopify Admin</p>
        </div>
      </div>

      <section className="dashboard-card">
        <h2>About this app</h2>
        <p style={{ color: "var(--dash-muted)", lineHeight: 1.6 }}>
          Standalone Shopify app for AI product optimization. Merchants install
          once and optimize titles, HTML descriptions, and SEO meta directly on
          products — no external website required.
        </p>
        <p style={{ color: "var(--dash-muted)", marginBottom: 0 }}>
          Configure <code>GEMINI_API_KEY</code> in your app environment for
          full AI generation.
        </p>
      </section>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
