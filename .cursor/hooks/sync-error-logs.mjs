#!/usr/bin/env node
/**
 * On Cursor session start: if origin has newer shopify-app/logs/error-logs.jsonl,
 * check that file out so local logs match remote without a full merge.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Consume hook stdin (required).
try {
  await new Response(process.stdin).text();
} catch {
  /* empty */
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const rel = "shopify-app/logs/error-logs.jsonl";
const abs = join(root, rel);

function git(args) {
  return spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
}

function reply(payload) {
  process.stdout.write(JSON.stringify(payload));
}

const fetch = git(["fetch", "origin", "main", "--quiet"]);
if (fetch.status !== 0) {
  reply({});
  process.exit(0);
}

const remote = git(["show", `origin/main:${rel}`]);
if (remote.status !== 0 || !remote.stdout) {
  // Remote file may not exist yet.
  reply({});
  process.exit(0);
}

const remoteBody = remote.stdout.replace(/\r\n/g, "\n");
let localBody = "";
if (existsSync(abs)) {
  localBody = readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
}

if (localBody === remoteBody) {
  reply({});
  process.exit(0);
}

mkdirSync(dirname(abs), { recursive: true });
writeFileSync(abs, remoteBody.endsWith("\n") ? remoteBody : `${remoteBody}\n`, "utf8");

reply({
  additional_context:
    "Synced shopify-app/logs/error-logs.jsonl from origin/main (remote log changes detected).",
});
process.exit(0);
