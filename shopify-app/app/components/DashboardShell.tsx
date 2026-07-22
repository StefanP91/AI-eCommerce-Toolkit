import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";

const NAV = [
  { to: "/app", label: "Dashboard", end: true },
  { to: "/app/products", label: "Products" },
  { to: "/app/additional", label: "Settings" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="dashboard-root">
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="dashboard-brand">
            <div className="dashboard-brand-badge">AI</div>
            <span>AI Commerce Suite</span>
          </div>
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
