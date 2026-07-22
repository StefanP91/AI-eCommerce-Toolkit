import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { PRO_BENEFITS, PRO_PRICE } from "../lib/billing";

type UpgradeActionData =
  | { ok: true; intent: "upgrade"; confirmationUrl: string }
  | { ok: false; error: string }
  | { ok: true; intent: "sync" };

const MODAL_BENEFITS = [
  ...PRO_BENEFITS,
  "No daily AI caps",
  "Faster catalog cleanup at scale",
] as const;

function useUpgradeCheckout() {
  const fetcher = useFetcher<UpgradeActionData>();
  const shopify = useAppBridge();
  const lastKey = useRef<string | null>(null);

  const isBusy =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (!fetcher.data || fetcher.state !== "idle") return;
    const key = JSON.stringify(fetcher.data);
    if (lastKey.current === key) return;
    lastKey.current = key;

    if (fetcher.data.ok && "confirmationUrl" in fetcher.data) {
      open(fetcher.data.confirmationUrl, "_top");
      return;
    }

    if (!fetcher.data.ok && "error" in fetcher.data && fetcher.data.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, fetcher.state, shopify]);

  const startCheckout = () => {
    const formData = new FormData();
    formData.set("intent", "upgrade");
    fetcher.submit(formData, { method: "post", action: "/app/settings" });
  };

  return { isBusy, startCheckout };
}

function ProUpgradeModal({
  open: isOpen,
  onClose,
  isBusy,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  isBusy: boolean;
  onConfirm: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, isBusy, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="dashboard-modal-overlay"
      role="presentation"
      onClick={() => {
        if (!isBusy) onClose();
      }}
    >
      <div
        className="dashboard-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dashboard-modal-head">
          <h2 id={titleId}>Upgrade to Pro</h2>
          <button
            type="button"
            className="dashboard-modal-close"
            aria-label="Close"
            disabled={isBusy}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <p className="dashboard-modal-price">${PRO_PRICE}/mo</p>
        <p className="dashboard-modal-lead">
          Unlock everything you need to optimize your catalog without daily
          limits.
        </p>

        <ul className="dashboard-modal-benefits">
          {MODAL_BENEFITS.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>

        <div className="dashboard-modal-actions">
          <button
            type="button"
            className="dashboard-btn dashboard-btn-ghost"
            disabled={isBusy}
            onClick={onClose}
          >
            Not now
          </button>
          <button
            type="button"
            className="dashboard-btn dashboard-btn-primary"
            disabled={isBusy}
            onClick={onConfirm}
          >
            {isBusy ? "Opening checkout..." : "Upgrade & pay"}
          </button>
        </div>

        <p className="dashboard-modal-note">
          You’ll confirm the charge in Shopify Admin. Cancel anytime from your
          app subscription.
        </p>
      </div>
    </div>
  );
}

function UpgradeTrigger({
  className,
  label,
  style,
}: {
  className?: string;
  label: ReactNode;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const { isBusy, startCheckout } = useUpgradeCheckout();

  return (
    <>
      <button
        type="button"
        className={className}
        style={style}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <ProUpgradeModal
        open={open}
        onClose={() => {
          if (!isBusy) setOpen(false);
        }}
        isBusy={isBusy}
        onConfirm={startCheckout}
      />
    </>
  );
}

export function UpgradeToProButton({
  className = "dashboard-btn dashboard-btn-primary",
  label = "Upgrade to Pro",
}: {
  className?: string;
  label?: string;
}) {
  return <UpgradeTrigger className={className} label={label} />;
}

export function UpgradeToProLink({
  className,
  children = "Upgrade to Pro",
}: {
  className?: string;
  children?: string;
}) {
  return (
    <UpgradeTrigger
      className={className}
      label={children}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        color: "inherit",
        font: "inherit",
        fontWeight: 600,
        cursor: "pointer",
        textDecoration: "underline",
      }}
    />
  );
}
