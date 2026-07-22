import { useEffect, useState } from "react";
import { Link } from "react-router";

const STORAGE_KEY = "acs_onboarding_dismissed_v1";

/**
 * First-install onboarding: generate → review → apply.
 * Dismissed state is stored in localStorage per browser.
 */
export function OnboardingBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== "1") {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <section className="dashboard-card dashboard-onboarding" aria-label="Getting started">
      <div className="dashboard-onboarding-header">
        <div>
          <h2>Welcome — get your first win in 3 steps</h2>
          <p className="dashboard-settings-note" style={{ margin: 0 }}>
            Nothing is written to your catalog until you confirm Apply.
          </p>
        </div>
        <button
          type="button"
          className="dashboard-btn dashboard-btn-ghost"
          onClick={dismiss}
        >
          Dismiss
        </button>
      </div>
      <ol className="dashboard-settings-steps">
        <li>
          <strong>Generate</strong> — open a product and create an AI draft for title,
          description, or SEO.
        </li>
        <li>
          <strong>Review</strong> — edit the draft until it matches your brand voice.
        </li>
        <li>
          <strong>Apply</strong> — save only when you are ready; changes write to Shopify.
        </li>
      </ol>
      <div className="dashboard-tools-actions">
        <Link to="/app/products" className="dashboard-btn dashboard-btn-primary">
          Optimize a product
        </Link>
        <Link to="/app/tools" className="dashboard-btn dashboard-btn-ghost">
          Explore tools
        </Link>
        <Link to="/app/settings" className="dashboard-btn dashboard-btn-ghost">
          Plan &amp; settings
        </Link>
      </div>
    </section>
  );
}
