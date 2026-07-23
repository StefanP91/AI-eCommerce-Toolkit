import { useEffect } from "react";

/** Captures uncaught window errors into AppErrorLog (no Shopify auth required). */
export function ClientErrorBridge() {
  useEffect(() => {
    const send = (source: string, message: string, detail: string) => {
      const formData = new FormData();
      formData.set("source", source);
      formData.set("message", (message || "Unknown error").slice(0, 500));
      formData.set("detail", (detail || "").slice(0, 4000));
      formData.set("path", window.location.pathname);
      void fetch("/api/client-error", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        keepalive: true,
      });
    };

    const onError = (event: ErrorEvent) => {
      send(
        "window.onerror",
        event.message || "Uncaught error",
        [
          event.filename &&
            `file=${event.filename}:${event.lineno}:${event.colno}`,
          event.error instanceof Error ? event.error.stack : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      send(
        "unhandledrejection",
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection",
        reason instanceof Error ? reason.stack || "" : String(reason ?? ""),
      );
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
