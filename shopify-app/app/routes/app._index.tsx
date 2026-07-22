import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { buildDashboardStats, scoreProduct } from "../lib/products";
import { fetchProducts } from "../lib/products.server";
import {
  buildDashboardReportCsv,
  downloadCsv,
} from "../lib/dashboard-report";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const products = await fetchProducts(admin);
  const stats = buildDashboardStats(products);
  const exportedAt = new Date().toISOString();

  return {
    stats,
    reportRows: products.map((product) => ({
      title: product.title,
      handle: product.handle,
      status: product.status,
      seoScore: scoreProduct(product),
      metaTitle: product.seo?.title ?? "",
      metaDescription: product.seo?.description ?? "",
    })),
    exportedAt,
    aiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
  };
};

export default function DashboardPage() {
  const { stats, reportRows, exportedAt, aiConfigured } =
    useLoaderData<typeof loader>();
  const shopify = useAppBridge();

  const handleExportReport = () => {
    const csv = buildDashboardReportCsv(stats, reportRows, exportedAt);
    const date = exportedAt.slice(0, 10);
    downloadCsv(`ai-commerce-suite-report-${date}.csv`, csv);
    shopify.toast.show("Report downloaded");
  };
  const donutStyle = {
    background: `conic-gradient(
      #47bfff 0 ${stats.seoBreakdown.excellent}%,
      #2ee6a8 ${stats.seoBreakdown.excellent}% ${stats.seoBreakdown.excellent + stats.seoBreakdown.good}%,
      #ffc107 ${stats.seoBreakdown.excellent + stats.seoBreakdown.good}% ${stats.seoBreakdown.excellent + stats.seoBreakdown.good + stats.seoBreakdown.needsWork}%,
      #ff6b6b ${stats.seoBreakdown.excellent + stats.seoBreakdown.good + stats.seoBreakdown.needsWork}% 100%
    )`,
  };

  return (
    <>
      <div className="dashboard-topbar">
        <div>
          <h1>Dashboard</h1>
          <p>Designed for Shopify · AI-powered product optimization</p>
        </div>
        <div className="dashboard-topbar-actions">
          <span className="dashboard-pill">Last 7 days</span>
          <button
            type="button"
            className="dashboard-btn dashboard-btn-ghost"
            onClick={handleExportReport}
          >
            Export report
          </button>
        </div>
      </div>

      {!aiConfigured && (
        <div className="dashboard-warning">
          Add <code>GEMINI_API_KEY</code> to <code>shopify-app/.env</code> for full AI
          generation.
        </div>
      )}

      <div className="dashboard-stats">
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-label">Products Optimized</div>
          <div className="dashboard-stat-value">{stats.productsOptimized}</div>
          <div className="dashboard-stat-delta">↑ {stats.totalProducts ? Math.round((stats.productsOptimized / stats.totalProducts) * 100) : 0}% of catalog</div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-label">Time Saved</div>
          <div className="dashboard-stat-value">{stats.timeSavedHours}h</div>
          <div className="dashboard-stat-delta">↑ Est. from AI runs</div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-label">SEO Score</div>
          <div className="dashboard-stat-value">{stats.avgSeoScore}/100</div>
          <div className="dashboard-stat-delta">↑ Store average</div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-label">CTR Estimate</div>
          <div className="dashboard-stat-value">{stats.ctrEstimate}%</div>
          <div className="dashboard-stat-delta">↑ Potential uplift</div>
        </div>
      </div>

      <div className="dashboard-grid-2">
        <section className="dashboard-card">
          <h2>Products to optimize</h2>
          <div className="dashboard-activity">
            {stats.recentActivity.length === 0 ? (
              <p style={{ color: "var(--dash-muted)", margin: 0 }}>
                No products yet. Add products in Shopify to see status here.
              </p>
            ) : (
              stats.recentActivity.map((item) => (
                <div key={item.id} className="dashboard-activity-item">
                  <div>
                    <div className="dashboard-activity-title">{item.title}</div>
                    <div className="dashboard-activity-sub">{item.type}</div>
                  </div>
                  <span className="dashboard-activity-sub">
                    SEO {item.seoScore}/100
                  </span>
                  <span
                    className={`dashboard-badge ${
                      item.status === "Optimized"
                        ? "dashboard-badge-success"
                        : "dashboard-badge-pending"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="dashboard-card">
          <h2>SEO Score Overview</h2>
          <div className="dashboard-seo-wrap">
            <div className="dashboard-donut" style={donutStyle}>
              <div className="dashboard-donut-center">
                <strong>{stats.avgSeoScore}</strong>
                <span>
                  {stats.avgSeoScore >= 80
                    ? "Excellent"
                    : stats.avgSeoScore >= 60
                      ? "Good"
                      : "Needs work"}
                </span>
              </div>
            </div>
            <div className="dashboard-legend">
              <div className="dashboard-legend-row">
                <span>
                  <span className="dashboard-dot" style={{ background: "#47bfff" }} />
                  Excellent
                </span>
                <span>{stats.seoBreakdown.excellent}%</span>
              </div>
              <div className="dashboard-legend-row">
                <span>
                  <span className="dashboard-dot" style={{ background: "#2ee6a8" }} />
                  Good
                </span>
                <span>{stats.seoBreakdown.good}%</span>
              </div>
              <div className="dashboard-legend-row">
                <span>
                  <span className="dashboard-dot" style={{ background: "#ffc107" }} />
                  Needs work
                </span>
                <span>{stats.seoBreakdown.needsWork}%</span>
              </div>
              <div className="dashboard-legend-row">
                <span>
                  <span className="dashboard-dot" style={{ background: "#ff6b6b" }} />
                  Poor
                </span>
                <span>{stats.seoBreakdown.poor}%</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
