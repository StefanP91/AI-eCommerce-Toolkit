import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { isGeminiConfigured } from "../lib/gemini.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

  return {
    shop: session.shop,
    aiConfigured: isGeminiConfigured(),
    model,
    scopes: "read_products, write_products",
  };
};

export default function SettingsPage() {
  const { shop, aiConfigured, model, scopes } = useLoaderData<typeof loader>();

  return (
    <>
      <div className="dashboard-topbar">
        <div>
          <h1>Settings</h1>
          <p>Store connection, AI status, and what this app can do</p>
        </div>
      </div>

      <div className="dashboard-settings-grid">
        <section className="dashboard-card">
          <h2>Store</h2>
          <dl className="dashboard-settings-list">
            <div>
              <dt>Connected shop</dt>
              <dd>{shop}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>{scopes}</dd>
            </div>
          </dl>
          <p className="dashboard-settings-note">
            The app can read and update products and collections in this store.
            Uninstall from Shopify Admin if you want to revoke access.
          </p>
        </section>

        <section className="dashboard-card">
          <h2>AI</h2>
          <div className="dashboard-settings-status">
            <span
              className={`dashboard-badge ${
                aiConfigured
                  ? "dashboard-badge-success"
                  : "dashboard-badge-pending"
              }`}
            >
              {aiConfigured ? "Ready" : "Not configured"}
            </span>
            <span className="dashboard-settings-meta">Model: {model}</span>
          </div>
          <p className="dashboard-settings-note">
            {aiConfigured
              ? "Gemini is connected. Product optimize, translate, SEO tools, and image optimizer can generate content."
              : "AI generation is unavailable until the app owner adds a Gemini API key on the server. Schema markup still works without it."}
          </p>
        </section>
      </div>

      <section className="dashboard-card">
        <h2>Features</h2>
        <div className="dashboard-settings-features">
          <div>
            <h3>Products</h3>
            <p>
              Optimize titles, descriptions, and SEO meta. Bulk translate and
              generate image alt text.
            </p>
            <Link to="/app/products" className="dashboard-btn dashboard-btn-ghost">
              Open Products
            </Link>
          </div>
          <div>
            <h3>Collections</h3>
            <p>
              Improve collection titles and SEO copy one by one or in bulk.
            </p>
            <Link
              to="/app/collections"
              className="dashboard-btn dashboard-btn-ghost"
            >
              Open Collections
            </Link>
          </div>
          <div>
            <h3>Tools</h3>
            <p>
              Translator, title ideas, image optimizer (compress + alt text),
              and product schema JSON-LD.
            </p>
            <Link to="/app/tools" className="dashboard-btn dashboard-btn-ghost">
              Open Tools
            </Link>
          </div>
          <div>
            <h3>Dashboard</h3>
            <p>
              SEO overview, today’s activity, and a quick list of products that
              still need work.
            </p>
            <Link to="/app" className="dashboard-btn dashboard-btn-ghost">
              Open Dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="dashboard-card">
        <h2>How it works</h2>
        <ol className="dashboard-settings-steps">
          <li>Pick a product, collection, or tool.</li>
          <li>Generate a draft with AI and review it.</li>
          <li>Apply only when you are ready — nothing is saved until you confirm.</li>
        </ol>
        <p className="dashboard-settings-note" style={{ marginBottom: 0 }}>
          AI Commerce Suite runs inside Shopify Admin. Changes write directly to
          your catalog — there is no separate storefront to manage.
        </p>
      </section>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
