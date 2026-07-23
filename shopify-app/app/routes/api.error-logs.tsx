import type { LoaderFunctionArgs } from "react-router";
import {
  formatErrorLogsJsonl,
  listAppErrors,
} from "../lib/error-log.server";

/**
 * Pull recent AppErrorLog rows as JSONL.
 * Auth: Authorization: Bearer <LOG_EXPORT_SECRET> or ?secret=
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const expected = process.env.LOG_EXPORT_SECRET?.trim();
  if (!expected) {
    return new Response("LOG_EXPORT_SECRET is not configured", { status: 503 });
  }

  const url = new URL(request.url);
  const header = request.headers.get("authorization") || "";
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const querySecret = url.searchParams.get("secret")?.trim();
  const provided = bearer || querySecret;

  if (!provided || provided !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  const limit = Number(url.searchParams.get("limit") || "200");
  const rows = await listAppErrors(limit);
  const body = formatErrorLogsJsonl(rows);

  return new Response(body ? `${body}\n` : "", {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
