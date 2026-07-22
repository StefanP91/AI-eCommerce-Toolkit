import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";

const NAV = [
  { to: "/app", label: "Dashboard", end: true },
  { to: "/app/products", label: "Products" },
  { to: "/app/collections", label: "Collections" },
  { to: "/app/tools", label: "Tools" },
  { to: "/app/additional", label: "Settings" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const location = useLocation();

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
        </aside>
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
