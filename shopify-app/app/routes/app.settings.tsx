import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Link, useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect, useRef } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { isGeminiConfigured } from "../lib/gemini.server";
import {
  buildBillingReturnUrl,
  canUseAi,
  createProSubscription,
  FREE_DAILY_AI_LIMIT,
  planSummary,
  PRO_PRICE,
  setDevPlan,
  syncSubscriptionFromShopify,
  useDevBillingBypass,
} from "../lib/billing.server";
import { UpgradeToProButton } from "../components/UpgradeToProButton";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);

  if (
    url.searchParams.get("billing") === "1" ||
    url.searchParams.has("charge_id")
  ) {
    await syncSubscriptionFromShopify(admin, session.shop);
  }

  const billing = await canUseAi(session.shop);

  return {
    shop: session.shop,
    aiConfigured: isGeminiConfigured(),
    billing,
    summary: planSummary(billing),
    freeLimit: FREE_DAILY_AI_LIMIT,
    proPrice: PRO_PRICE,
    devPlanToggle: useDevBillingBypass(),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "upgrade") {
    try {
      const returnUrl = await buildBillingReturnUrl(admin, session.shop);
      const { confirmationUrl, usedDevBypass } = await createProSubscription(
        admin,
        session.shop,
        returnUrl,
      );
      return {
        ok: true as const,
        intent: "upgrade" as const,
        confirmationUrl,
        usedDevBypass,
      };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error
            ? error.message
            : "Could not start Pro upgrade",
      };
    }
  }

  if (intent === "sync") {
    await syncSubscriptionFromShopify(admin, session.shop);
    return { ok: true as const, intent: "sync" as const };
  }

  if (intent === "dev_plan") {
    const plan = String(formData.get("plan") || "") === "pro" ? "pro" : "free";
    try {
      await setDevPlan(session.shop, plan);
      return { ok: true as const, intent: "dev_plan" as const, plan };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error ? error.message : "Could not switch plan",
      };
    }
  }

  return { ok: false as const, error: "Unknown action" };
};

export default function SettingsPage() {
  const {
    shop,
    aiConfigured,
    billing,
    summary,
    freeLimit,
    proPrice,
    devPlanToggle,
  } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const lastToastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!fetcher.data || fetcher.state !== "idle") return;
    const toastKey = JSON.stringify(fetcher.data);
    if (lastToastKey.current === toastKey) return;
    lastToastKey.current = toastKey;

    if (fetcher.data.ok && "confirmationUrl" in fetcher.data) {
      if (
        "usedDevBypass" in fetcher.data &&
        fetcher.data.usedDevBypass
      ) {
        shopify.toast.show(
          "Dev bypass still ON — restart shopify app dev after BILLING_DEV_BYPASS=0",
          { isError: true },
        );
        return;
      }
      const url = fetcher.data.confirmationUrl;
      open(url, "_top");
      return;
    }

    if (fetcher.data.ok && fetcher.data.intent === "sync") {
      shopify.toast.show("Plan status refreshed");
      return;
    }

    if (fetcher.data.ok && fetcher.data.intent === "dev_plan") {
      shopify.toast.show(
        fetcher.data.plan === "pro"
          ? "Dev plan: Pro"
          : "Dev plan: Free",
      );
      return;
    }

    if (!fetcher.data.ok && "error" in fetcher.data && fetcher.data.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, fetcher.state, shopify]);

  const isBusy =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  return (
    <>
      <div className="dashboard-topbar">
        <div>
          <h1>Settings</h1>
          <p>Store connection, plan, and what this app can do</p>
        </div>
      </div>

      <div className="dashboard-settings-grid">
        <section className="dashboard-card">
          <h2>Store</h2>
          <dl className="dashboard-settings-list">
            <div>
              <dt>This install</dt>
              <dd>{shop}</dd>
            </div>
          </dl>
          <p className="dashboard-settings-note">
            Everything you do here only affects this Shopify store. Install the
            same app on another store and that shop gets its own separate
            workspace — catalogs are never mixed.
          </p>
        </section>

        <section className="dashboard-card">
          <h2>Plan</h2>
          <div className="dashboard-settings-status">
            <span
              className={`dashboard-badge ${
                billing.plan === "pro"
                  ? "dashboard-badge-success"
                  : "dashboard-badge-pending"
              }`}
            >
              {summary.name}
            </span>
            <span className="dashboard-settings-meta">{summary.priceLabel}</span>
          </div>
          <p className="dashboard-settings-note" style={{ marginTop: 0 }}>
            {summary.usageLabel}
          </p>
          {devPlanToggle ? (
            <p className="dashboard-settings-note" style={{ color: "#ffd666" }}>
              Dev toggle ON (`BILLING_DEV_BYPASS=1`): use Switch Free/Pro below.
              Upgrade always goes through Shopify Billing.
            </p>
          ) : (
            <p className="dashboard-settings-note">
              Billing mode: <strong>Shopify Billing API</strong> (real/test
              charge confirmation).
            </p>
          )}
          <ul className="dashboard-settings-plan-features">
            {summary.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          {billing.plan === "free" ? (
            <div className="dashboard-tools-actions" style={{ marginTop: "0.9rem" }}>
              <UpgradeToProButton
                className="dashboard-btn dashboard-btn-primary"
                label={`Upgrade to Pro — $${proPrice}/mo`}
              />
            </div>
          ) : (
            <>
              <p className="dashboard-settings-note">
                Pro is active. To manage or cancel your subscription, open{" "}
                <strong>Shopify Admin → Settings → Apps and sales channels</strong>{" "}
                (or Billing), find AI Commerce Suite, and manage the plan there.
                Charges appear on your Shopify invoice.
              </p>
              <p className="dashboard-settings-note">
                After cancelling, click <em>Refresh plan status</em> below if the
                app still shows Pro.
              </p>
            </>
          )}
          <fetcher.Form method="post" style={{ marginTop: "0.6rem" }}>
            <input type="hidden" name="intent" value="sync" />
            <button
              type="submit"
              className="dashboard-btn dashboard-btn-ghost"
              disabled={isBusy}
            >
              Refresh plan status
            </button>
          </fetcher.Form>
          {devPlanToggle && (
            <div
              className="dashboard-tools-actions"
              style={{ marginTop: "0.9rem" }}
            >
              <p className="dashboard-settings-note" style={{ margin: 0, flexBasis: "100%" }}>
                Dev only (`BILLING_DEV_BYPASS=1`): switch Free/Pro without Shopify
                charges. Upgrade always uses Shopify Billing.
              </p>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="dev_plan" />
                <input type="hidden" name="plan" value="free" />
                <button
                  type="submit"
                  className="dashboard-btn dashboard-btn-ghost"
                  disabled={isBusy || billing.plan === "free"}
                >
                  Switch to Free
                </button>
              </fetcher.Form>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="dev_plan" />
                <input type="hidden" name="plan" value="pro" />
                <button
                  type="submit"
                  className="dashboard-btn dashboard-btn-primary"
                  disabled={isBusy || billing.plan === "pro"}
                >
                  Switch to Pro
                </button>
              </fetcher.Form>
            </div>
          )}
        </section>
      </div>

      <div className="dashboard-settings-grid">
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
          </div>
          <p className="dashboard-settings-note">
            {aiConfigured
              ? "Powers Product Optimize, Translate, SEO tools, and Image Optimizer."
              : "AI generation is unavailable until the app owner adds an API key on the server. Schema markup still works without it."}
          </p>
        </section>

        <section className="dashboard-card">
          <h2>Free vs Pro</h2>
          <p className="dashboard-settings-note" style={{ marginTop: 0 }}>
            Free includes {freeLimit} AI actions per day. Browse and Schema stay
            unlimited. Bulk optimize is Pro-only. Pro removes the daily cap.
          </p>
          <p className="dashboard-settings-note" style={{ marginBottom: 0 }}>
            Billing is handled by Shopify — you approve the charge in Admin, and
            it appears on the shop’s Shopify invoice.
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

      <section className="dashboard-card dashboard-settings-how">
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

      <section className="dashboard-card dashboard-settings-support">
        <h2>Support &amp; legal</h2>
        <p className="dashboard-settings-note" style={{ marginTop: 0 }}>
          Questions or issues? Email{" "}
          <a
            href="mailto:stefanpanov0@gmail.com"
            target="_blank"
            rel="noreferrer"
          >
            stefanpanov0@gmail.com
          </a>
          .
        </p>
        <div className="dashboard-tools-actions">
          <a
            className="dashboard-btn dashboard-btn-ghost"
            href="https://ai-ecommerce-suite.netlify.app/privacy"
            target="_blank"
            rel="noreferrer"
          >
            Privacy Policy
          </a>
          <a
            className="dashboard-btn dashboard-btn-ghost"
            href="https://ai-ecommerce-suite.netlify.app/terms"
            target="_blank"
            rel="noreferrer"
          >
            Terms of Service
          </a>
          <a
            className="dashboard-btn dashboard-btn-ghost"
            href="mailto:stefanpanov0@gmail.com"
            target="_blank"
            rel="noreferrer"
          >
            Contact support
          </a>
        </div>
      </section>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
