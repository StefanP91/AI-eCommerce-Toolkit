import type { HeadersFunction, LinksFunction, LoaderFunctionArgs } from "react-router";
import { Link, Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { DashboardShell } from "../components/DashboardShell";
import { canUseAi } from "../lib/billing.server";
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
  };
};

export default function App() {
  const { apiKey, billing } = useLoaderData<typeof loader>();

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
      </NavMenu>
      <DashboardShell billing={billing}>
        <Outlet />
      </DashboardShell>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
