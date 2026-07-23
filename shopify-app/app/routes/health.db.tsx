import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { isGeminiConfigured } from "../lib/gemini.server";

/** Unauthenticated diagnostics for production outages (no secrets). */
export const loader = async (_args: LoaderFunctionArgs) => {
  const checks: Record<string, unknown> = {
    ok: true,
    nodeEnv: process.env.NODE_ENV || null,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasApiKey: Boolean(process.env.SHOPIFY_API_KEY),
    hasApiSecret: Boolean(process.env.SHOPIFY_API_SECRET),
    hasGeminiKey: isGeminiConfigured(),
    geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    usesGeminiProxy: Boolean(
      process.env.GEMINI_PROXY_URL?.trim() &&
        process.env.GEMINI_PROXY_SECRET?.trim(),
    ),
    geminiProxyUrl: process.env.GEMINI_PROXY_URL?.trim() || null,
    appUrl: process.env.SHOPIFY_APP_URL || null,
    scopes: process.env.SCOPES || null,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.dbConnect = true;
  } catch (error) {
    checks.ok = false;
    checks.dbConnect = false;
    checks.dbConnectError =
      error instanceof Error ? error.message : String(error);
  }

  try {
    checks.sessionCount = await prisma.session.count();
    checks.sessionOk = true;
  } catch (error) {
    checks.ok = false;
    checks.sessionOk = false;
    checks.sessionError =
      error instanceof Error ? error.message : String(error);
  }

  try {
    checks.shopPlanCount = await prisma.shopPlan.count();
    checks.shopPlanOk = true;
  } catch (error) {
    checks.ok = false;
    checks.shopPlanOk = false;
    checks.shopPlanError =
      error instanceof Error ? error.message : String(error);
  }

  try {
    checks.appErrorLogCount = await prisma.appErrorLog.count();
    checks.appErrorLogOk = true;
  } catch (error) {
    checks.ok = false;
    checks.appErrorLogOk = false;
    checks.appErrorLogError =
      error instanceof Error ? error.message : String(error);
  }

  if (
    process.env.GEMINI_PROXY_URL?.trim() &&
    process.env.GEMINI_PROXY_SECRET?.trim()
  ) {
    try {
      const response = await fetch(process.env.GEMINI_PROXY_URL.trim(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gemini-Proxy-Secret": process.env.GEMINI_PROXY_SECRET.trim(),
        },
        body: JSON.stringify({
          prompt:
            'Return ONLY JSON: {"ok":true,"ping":"health"}',
          temperature: 0,
        }),
      });
      checks.geminiReachable = response.ok;
      checks.geminiStatus = response.status;
      if (!response.ok) {
        checks.ok = false;
        checks.geminiError = (await response.text()).slice(0, 180);
      }
    } catch (error) {
      checks.ok = false;
      checks.geminiReachable = false;
      checks.geminiError =
        error instanceof Error ? error.message : String(error);
    }
  } else if (isGeminiConfigured()) {
    const apiKey = process.env.GEMINI_API_KEY!.trim();
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${apiKey}`,
        { method: "GET" },
      );
      checks.geminiReachable = response.ok;
      checks.geminiStatus = response.status;
      if (!response.ok) {
        checks.ok = false;
        const body = await response.text();
        checks.geminiError = body.slice(0, 180);
      }
    } catch (error) {
      checks.ok = false;
      checks.geminiReachable = false;
      checks.geminiError =
        error instanceof Error ? error.message : String(error);
    }
  } else {
    checks.ok = false;
    checks.geminiReachable = false;
    checks.geminiError = "GEMINI_API_KEY / GEMINI_PROXY_URL missing on host";
  }

  return Response.json(checks, { status: checks.ok ? 200 : 503 });
};
