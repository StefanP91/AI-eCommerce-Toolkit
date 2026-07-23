import { useEffect } from "react";
import { useReportClientError } from "../hooks/useReportClientError";

/** Captures uncaught window errors and promise rejections into AppErrorLog. */
export function ClientErrorBridge() {
  const report = useReportClientError();

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      report({
        source: "window.onerror",
        message: event.message || "Uncaught error",
        detail: [
          event.filename && `file=${event.filename}:${event.lineno}:${event.colno}`,
          event.error instanceof Error ? event.error.stack : "",
        ]
          .filter(Boolean)
          .join("\n"),
        path: window.location.pathname,
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection";
      report({
        source: "unhandledrejection",
        message,
        detail: reason instanceof Error ? reason.stack || "" : String(reason ?? ""),
        path: window.location.pathname,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [report]);

  return null;
}
