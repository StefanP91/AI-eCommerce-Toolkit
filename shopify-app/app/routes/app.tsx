import type { HeadersFunction, LinksFunction, LoaderFunctionArgs } from "react-router";
import {
  Link,
  Outlet,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "react-router";
import { useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { DashboardShell } from "../components/DashboardShell";
import { ClientErrorBridge } from "../components/ClientErrorBridge";
import { canUseAi } from "../lib/billing.server";
import { canViewAppLogs } from "../lib/error-log.server";
import dashboardStyles from "../styles/dashboard.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: dashboardStyles },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const billing = await canUseAi(session.shop);

  // eslint-disable-next-line no-undef
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    billing,
    canViewLogs: canViewAppLogs(session.shop),
  };
};

export default function App() {
  const { apiKey, billing, canViewLogs } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Dashboard
        </Link>
        <Link to="/app/products">Products</Link>
        <Link to="/app/collections">Collections</Link>
        <Link to="/app/tools">Tools</Link>
        <Link to="/app/settings">Settings</Link>
        {canViewLogs ? <Link to="/app/logs">Logs</Link> : null}
      </NavMenu>
      <DashboardShell billing={billing}>
        <ClientErrorBridge />
        <Outlet />
      </DashboardShell>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  useEffect(() => {
    const message =
      error instanceof Error
        ? error.message
        : isRouteErrorResponse(error)
          ? `${error.status} ${error.statusText || "Error"}`.trim()
          : "Unexpected application error";
    const detail =
      isRouteErrorResponse(error) && typeof error.data === "string"
        ? error.data
        : error instanceof Error
          ? error.stack || error.message
          : String(error ?? "");

    const formData = new FormData();
    formData.set("source", "ErrorBoundary");
    formData.set("message", message.slice(0, 500));
    formData.set("detail", detail.slice(0, 4000));
    formData.set("path", window.location.pathname);
    void fetch("/api/client-error", {
      method: "POST",
      body: formData,
      credentials: "same-origin",
      keepalive: true,
    });
  }, [error]);

  // React Router may reconstruct auth bounces without ErrorResponse constructor —
  // still render App Bridge HTML so the embedded admin can complete session handshake.
  if (
    isRouteErrorResponse(error) &&
    typeof error.data === "string" &&
    error.data.includes("cdn.shopify.com/shopifycloud/app-bridge")
  ) {
    return <div dangerouslySetInnerHTML={{ __html: error.data }} />;
  }

  try {
    return boundary.error(error);
  } catch {
    const message =
      error instanceof Error
        ? error.message
        : isRouteErrorResponse(error)
          ? `${error.status} ${error.statusText || ""}`.trim()
          : "Unexpected application error";
    const detail =
      isRouteErrorResponse(error) && typeof error.data === "string"
        ? error.data
        : error instanceof Error && error.stack
          ? error.stack
          : "";

    return (
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1>Application Error</h1>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#fbeae5",
            padding: 16,
            borderRadius: 8,
          }}
        >
          {message}
          {detail ? `\n\n${detail}` : ""}
        </pre>
      </div>
    );
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
