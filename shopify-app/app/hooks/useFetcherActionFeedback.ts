import { useEffect, useRef } from "react";
import type { useFetcher } from "react-router";

type ToastFn = (message: string, opts?: { isError?: boolean }) => void;

type Options = {
  fetcher: ReturnType<typeof useFetcher>;
  shopify: { toast: { show: ToastFn } };
  /** Skip hang/empty handling while sequential bulk is driving the fetcher */
  disabled?: boolean;
  /** ms before showing a “still working” toast */
  hangWarnMs?: number;
  /** ms before treating a hang as failure */
  hangFailMs?: number;
  reportError?: (input: {
    source: string;
    message: string;
    detail?: string;
    path?: string;
  }) => void;
};

/**
 * Surfaces silent fetcher failures: empty response after POST, or long hangs.
 */
export function useFetcherActionFeedback({
  fetcher,
  shopify,
  disabled = false,
  hangWarnMs = 55000,
  hangFailMs = 160000,
  reportError,
}: Options) {
  const pendingSince = useRef<number | null>(null);
  const warnedHang = useRef(false);
  const reportedEmpty = useRef(false);

  useEffect(() => {
    if (disabled) {
      pendingSince.current = null;
      warnedHang.current = false;
      reportedEmpty.current = false;
      return;
    }

    const busy =
      fetcher.state === "submitting" ||
      (fetcher.state === "loading" && fetcher.formMethod === "POST");

    if (busy) {
      if (pendingSince.current == null) {
        pendingSince.current = Date.now();
        warnedHang.current = false;
        reportedEmpty.current = false;
      }
      return;
    }

    if (fetcher.state !== "idle") return;

    const started = pendingSince.current;
    pendingSince.current = null;

    if (started == null) return;
    if (fetcher.data != null) return;
    if (reportedEmpty.current) return;
    reportedEmpty.current = true;

    const message =
      "Request finished with no response. Check Error logs or try again.";
    shopify.toast.show(message, { isError: true });
    reportError?.({
      source: "fetcher.empty-response",
      message,
      detail: `formMethod=${fetcher.formMethod || ""}`,
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  }, [disabled, fetcher.data, fetcher.formMethod, fetcher.state, reportError, shopify]);

  useEffect(() => {
    if (disabled) return;

    const busy =
      fetcher.state === "submitting" ||
      (fetcher.state === "loading" && fetcher.formMethod === "POST");
    if (!busy || pendingSince.current == null) return;

    const tick = window.setInterval(() => {
      const started = pendingSince.current;
      if (started == null) return;
      const elapsed = Date.now() - started;

      if (!warnedHang.current && elapsed >= hangWarnMs) {
        warnedHang.current = true;
        shopify.toast.show(
          "Still optimizing… AI can take up to ~2 minutes. Keep this tab open.",
        );
      }

      if (elapsed >= hangFailMs) {
        shopify.toast.show(
          "Optimize is taking too long. If nothing appears, check Error logs.",
          { isError: true },
        );
        reportError?.({
          source: "fetcher.hang",
          message: `Action hung >${Math.round(hangFailMs / 1000)}s`,
          path:
            typeof window !== "undefined" ? window.location.pathname : undefined,
        });
        pendingSince.current = null;
        window.clearInterval(tick);
      }
    }, 5000);

    return () => window.clearInterval(tick);
  }, [
    disabled,
    fetcher.formMethod,
    fetcher.state,
    hangFailMs,
    hangWarnMs,
    reportError,
    shopify,
  ]);
}
