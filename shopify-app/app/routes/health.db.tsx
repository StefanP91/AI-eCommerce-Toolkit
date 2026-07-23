import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

/** Unauthenticated diagnostics for production outages (no secrets). */
export const loader = async (_args: LoaderFunctionArgs) => {
  const checks: Record<string, unknown> = {
    ok: true,
    nodeEnv: process.env.NODE_ENV || null,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasApiKey: Boolean(process.env.SHOPIFY_API_KEY),
    hasApiSecret: Boolean(process.env.SHOPIFY_API_SECRET),
    appUrl: process.env.SHOPIFY_APP_URL || null,
    scopes: process.env.SCOPES || null,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.dbConnect = true;
  } catch (error) {
    checks.ok = false;
    checks.dbConnect = false;
    checks.dbConnectError = error instanceof Error ? error.message : String(error);
  }

  try {
    checks.sessionCount = await prisma.session.count();
    checks.sessionOk = true;
  } catch (error) {
    checks.ok = false;
    checks.sessionOk = false;
    checks.sessionError = error instanceof Error ? error.message : String(error);
  }

  try {
    checks.shopPlanCount = await prisma.shopPlan.count();
    checks.shopPlanOk = true;
  } catch (error) {
    checks.ok = false;
    checks.shopPlanOk = false;
    checks.shopPlanError = error instanceof Error ? error.message : String(error);
  }

  return Response.json(checks, { status: checks.ok ? 200 : 503 });
};
