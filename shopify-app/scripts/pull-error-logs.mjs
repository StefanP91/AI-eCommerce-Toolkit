#!/usr/bin/env node
/**
 * Pull production AppErrorLog rows into shopify-app/logs/error-logs.jsonl
 *
 * Usage:
 *   LOG_EXPORT_SECRET=... node scripts/pull-error-logs.mjs
 *   APP_URL=https://ai-ecommerce-shopify-app.onrender.com LOG_EXPORT_SECRET=... node scripts/pull-error-logs.mjs
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outFile = join(root, "logs", "error-logs.jsonl");

const appUrl = (
  process.env.APP_URL ||
  process.env.SHOPIFY_APP_URL ||
  "https://ai-ecommerce-shopify-app.onrender.com"
).replace(/\/$/, "");
const secret = process.env.LOG_EXPORT_SECRET?.trim();
const limit = process.env.LOG_LIMIT || "200";

if (!secret) {
  console.error("Missing LOG_EXPORT_SECRET");
  process.exit(1);
}

const url = `${appUrl}/api/error-logs?limit=${encodeURIComponent(limit)}`;
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
});

if (!response.ok) {
  const body = await response.text();
  console.error(`Pull failed (${response.status}): ${body.slice(0, 400)}`);
  process.exit(1);
}

const fresh = (await response.text()).trim();
await mkdir(join(root, "logs"), { recursive: true });

let merged = fresh;
try {
  const existing = (await readFile(outFile, "utf8")).trim();
  if (existing) {
    const byId = new Map();
    for (const line of `${existing}\n${fresh}`.split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (row?.id) byId.set(row.id, line);
      } catch {
        /* skip bad lines */
      }
    }
    merged = [...byId.values()].join("\n");
  }
} catch {
  /* first pull */
}

await writeFile(outFile, merged ? `${merged}\n` : "", "utf8");
const count = merged ? merged.split("\n").filter(Boolean).length : 0;
console.log(`Wrote ${count} log line(s) to ${outFile}`);
