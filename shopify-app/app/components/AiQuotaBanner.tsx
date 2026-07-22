import type { AiAccess } from "../lib/billing";
import { UpgradeToProLink } from "./UpgradeToProButton";

/** Compact usage strip for Free plan pages (sidebar has the full upgrade card). */
export function AiQuotaBanner({ billing }: { billing: AiAccess }) {
  if (billing.plan === "pro" || billing.limit == null) return null;

  const remaining = Math.max(0, billing.limit - billing.used);
  const percent = Math.min(
    100,
    Math.round((billing.used / billing.limit) * 100),
  );

  return (
    <div className="dashboard-usage-strip">
      <div className="dashboard-usage-strip-top">
        <strong>
          AI today: {billing.used}/{billing.limit}
        </strong>
        <span>
          {remaining === 0
            ? "Limit reached"
            : `${remaining} left`}
        </span>
      </div>
      <div className="dashboard-plan-usage-bar dashboard-usage-strip-bar">
        <div
          className="dashboard-plan-usage-fill"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="dashboard-usage-strip-cta">
        {remaining === 0
          ? "Upgrade to Pro for unlimited AI and bulk actions."
          : "Pro unlocks unlimited AI + bulk optimize."}{" "}
        <UpgradeToProLink />
      </p>
    </div>
  );
}
