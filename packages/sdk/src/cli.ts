#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const command = process.argv[2];

if (command === "--version" || command === "-v") {
  console.log("0.0.1");
  process.exit(0);
}

if (!command || command === "--help" || command === "-h") {
  console.log(`byoa

usage:
  npx byoa deploy

requirements:
  - Node.js 20+
  - Cloudflare Workers Paid with Containers enabled
  - Wrangler OAuth or CLOUDFLARE_API_TOKEN

optional:
  BYOA_APP_SECRET  reuse an existing backend secret`);
  process.exit(0);
}

if (command !== "deploy") {
  console.error(`unknown command: ${command}\nrun \"byoa --help\" for usage.`);
  process.exit(1);
}

function run(executable: string, args: string[], cwd: string, input?: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: process.env,
      stdio: [input ? "pipe" : "inherit", "inherit", "inherit"],
    });
    if (input && child.stdin) child.stdin.end(input);
    child.on("error", reject);
    child.on("exit", (code) => code === 0
      ? resolve()
      : reject(new Error(`${executable} exited with code ${code ?? "unknown"}`)));
  });
}

const bundledRunner = join(dirname(fileURLToPath(import.meta.url)), "runner");
const deployDirectory = await mkdtemp(join(tmpdir(), "byoa-deploy-"));
const providedSecret = process.env.BYOA_APP_SECRET;
const secret = providedSecret ?? randomBytes(32).toString("base64url");

try {
  await cp(bundledRunner, deployDirectory, { recursive: true });

  console.log("\npreparing the runner…\n");
  await run("npm", ["install", "--include=dev", "--no-fund", "--no-audit"], deployDirectory);

  console.log("\nchecking Cloudflare…\n");
  await run("npx", ["--no-install", "wrangler", "whoami"], deployDirectory);

  console.log("\nsetting the runner secret…\n");
  await run("npx", ["--no-install", "wrangler", "secret", "put", "BYOA_APP_SECRET"], deployDirectory, `${secret}\n`);

  console.log("\ndeploying the runner…\n");
  await run("npx", ["--no-install", "wrangler", "deploy"], deployDirectory);

  console.log("\nBYOA is deployed.");
  if (!providedSecret) {
    console.log("\nsave this in your app backend as BYOA_APP_SECRET:\n");
    console.log(secret);
    console.log("\nit will not be shown again. never put it in browser code.");
  }
} catch (error) {
  console.error(`\ndeploy failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await rm(deployDirectory, { recursive: true, force: true });
}
