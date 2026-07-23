import { useCallback } from "react";
import { useFetcher } from "react-router";

/** POST client errors to /app/report-error (authenticated). */
export function useReportClientError() {
  const fetcher = useFetcher();

  return useCallback(
    (input: {
      source: string;
      message: string;
      detail?: string;
      path?: string;
    }) => {
      const formData = new FormData();
      formData.set("source", input.source);
      formData.set("message", input.message);
      if (input.detail) formData.set("detail", input.detail);
      if (input.path) formData.set("path", input.path);
      fetcher.submit(formData, { method: "post", action: "/app/report-error" });
    },
    [fetcher],
  );
}
