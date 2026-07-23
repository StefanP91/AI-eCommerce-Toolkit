import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { canViewAppLogs, listAppErrors } from "../lib/error-log.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  if (!canViewAppLogs(session.shop)) {
    throw new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || "80");
  // Owner tooling: all shops. Merchants never reach this page.
  const logs = await listAppErrors(limit);
  return { logs, shop: session.shop };
};

export default function AppLogsPage() {
  const { logs } = useLoaderData<typeof loader>();

  return (
    <div className="dashboard-page">
      <div className="dashboard-page-header">
        <div>
          <h1>Error logs</h1>
          <p style={{ margin: 0, opacity: 0.8 }}>
            Owner-only view of recent failures (all shops). Synced to{" "}
            <code>shopify-app/logs/</code> via the pull workflow /{" "}
            <code>npm run logs:pull</code>.
          </p>
        </div>
        <Link to="/app/settings" className="dashboard-btn dashboard-btn-ghost">
          Back to Settings
        </Link>
      </div>

      {logs.length === 0 ? (
        <section className="dashboard-card">
          <p style={{ margin: 0, opacity: 0.8 }}>
            No errors logged yet.
          </p>
        </section>
      ) : (
        <section className="dashboard-card" style={{ overflowX: "auto" }}>
          <table
            className="dashboard-table"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <th align="left">When</th>
                <th align="left">Source</th>
                <th align="left">Shop</th>
                <th align="left">Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row: (typeof logs)[number]) => (
                <tr key={row.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <code>{row.source}</code>
                  </td>
                  <td>{row.shop || "—"}</td>
                  <td>
                    <div>{row.message}</div>
                    {row.path ? (
                      <div style={{ fontSize: "0.85em", opacity: 0.75 }}>
                        {row.path}
                      </div>
                    ) : null}
                    {row.detail ? (
                      <pre
                        style={{
                          margin: "0.4rem 0 0",
                          whiteSpace: "pre-wrap",
                          fontSize: "0.8em",
                          maxHeight: "8rem",
                          overflow: "auto",
                          opacity: 0.8,
                        }}
                      >
                        {row.detail}
                      </pre>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
