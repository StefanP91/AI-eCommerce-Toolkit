import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import {
  FREE_DAILY_AI_LIMIT,
  PRO_BENEFITS,
  PRO_PRICE,
  type AiAccess,
} from "../lib/billing";
import { UpgradeToProButton } from "./UpgradeToProButton";

const NAV = [
  { to: "/app", label: "Dashboard", end: true },
  { to: "/app/products", label: "Products" },
  { to: "/app/collections", label: "Collections" },
  { to: "/app/tools", label: "Tools" },
  { to: "/app/settings", label: "Settings" },
];

export function DashboardShell({
  children,
  billing,
}: {
  children: ReactNode;
  billing: AiAccess;
}) {
  const location = useLocation();
  const plan = billing.plan;
  const limit = billing.limit ?? FREE_DAILY_AI_LIMIT;
  const used = billing.used;
  const remaining = Math.max(0, limit - used);
  const usagePercent =
    plan === "free" ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className="dashboard-root">
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <Link to="/app" className="dashboard-brand">
            <img
              src="/branding/logo-horizontal-light.png"
              alt="AI Commerce Suite"
              className="dashboard-brand-logo"
            />
          </Link>

          <nav className="dashboard-nav">
            {NAV.map((item) => {
              const active = item.end
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={active ? "active" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="dashboard-plan-panel">
            <div className="dashboard-plan-panel-head">
              <span
                className={`dashboard-badge ${
                  plan === "pro"
                    ? "dashboard-badge-success"
                    : "dashboard-badge-pending"
                }`}
              >
                {plan === "pro" ? "Pro" : "Free"}
              </span>
              {plan === "pro" ? (
                <span className="dashboard-plan-panel-meta">Unlimited AI</span>
              ) : (
                <span className="dashboard-plan-panel-meta">
                  {used}/{limit} today
                </span>
              )}
            </div>

            {plan === "free" ? (
              <>
                <div
                  className="dashboard-plan-usage-bar"
                  aria-label={`${used} of ${limit} AI actions used today`}
                >
                  <div
                    className="dashboard-plan-usage-fill"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="dashboard-plan-usage-text">
                  {remaining === 0
                    ? "Daily AI limit reached"
                    : `${remaining} AI action${remaining === 1 ? "" : "s"} left today`}
                </p>

                <div className="dashboard-plan-upgrade">
                  <p className="dashboard-plan-upgrade-title">
                    Upgrade to Pro — ${PRO_PRICE}/mo
                  </p>
                  <ul className="dashboard-plan-benefits">
                    {PRO_BENEFITS.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                  <UpgradeToProButton className="dashboard-btn dashboard-btn-primary dashboard-plan-upgrade-btn" />
                </div>
              </>
            ) : (
              <p className="dashboard-plan-usage-text">
                Bulk + unlimited AI unlocked.
              </p>
            )}
          </div>
        </aside>
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
