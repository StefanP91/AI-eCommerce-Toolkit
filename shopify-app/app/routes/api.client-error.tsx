import type { ActionFunctionArgs } from "react-router";
import { logAppError } from "../lib/error-log.server";

/**
 * Public-ish sink for ErrorBoundary / client reports when session auth may be broken.
 * Still required to be same-origin POST from the app.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const formData = await request.formData();
  await logAppError({
    shop: String(formData.get("shop") || "").trim() || null,
    source: String(formData.get("source") || "frontend").slice(0, 80),
    level: "error",
    message: String(formData.get("message") || "Unknown frontend error").slice(
      0,
      500,
    ),
    detail: String(formData.get("detail") || "").slice(0, 4000) || null,
    path: String(formData.get("path") || "").slice(0, 300) || null,
  });

  return Response.json({ ok: true });
};
