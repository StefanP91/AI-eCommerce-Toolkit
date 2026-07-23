import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { logAppError } from "../lib/error-log.server";

/** Authenticated sink for frontend / client-side error reports. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  await logAppError({
    shop: session.shop,
    source: String(formData.get("source") || "frontend").slice(0, 80),
    level: "error",
    message: String(formData.get("message") || "Unknown frontend error").slice(
      0,
      500,
    ),
    detail: String(formData.get("detail") || "").slice(0, 4000) || null,
    path: String(formData.get("path") || "").slice(0, 300) || null,
  });

  return { ok: true as const };
};
