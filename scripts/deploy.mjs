#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

const config = "workers/runner/wrangler.jsonc";

if (process.argv.includes("--help")) {
  console.log(`byoa deploy

deploy the runner to your Cloudflare account.

requirements:
  - Workers Paid with Containers enabled
  - Wrangler OAuth, or CLOUDFLARE_API_TOKEN in the environment

optional:
  BYOA_APP_SECRET  reuse an existing backend secret`);
  process.exit(0);
}

function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: [input ? "pipe" : "inherit", "inherit", "inherit"],
    });
    if (input) child.stdin.end(input);
    child.on("error", reject);
    child.on("exit", (code) => code === 0
      ? resolve()
      : reject(new Error(`${command} exited with code ${code ?? "unknown"}`)));
  });
}

const providedSecret = process.env.BYOA_APP_SECRET;
const secret = providedSecret ?? randomBytes(32).toString("base64url");

try {
  console.log("\nchecking Cloudflare…\n");
  await run("npx", ["wrangler", "whoami"]);
  console.log("\nsetting runner secret…\n");
  await run("npx", ["wrangler", "secret", "put", "BYOA_APP_SECRET", "--config", config], `${secret}\n`);
  console.log("\ndeploying runner…\n");
  await run("npx", ["wrangler", "deploy", "--config", config]);
  console.log("\nBYOA is deployed.");
  if (!providedSecret) {
    console.log("\nsave this in your app backend as BYOA_APP_SECRET:\n");
    console.log(secret);
    console.log("\nit will not be shown again. never put it in browser code.");
  }
} catch (error) {
  console.error(`\ndeploy failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
