import { spawn } from "node:child_process";
import { resolve } from "node:path";

const config = resolve("workers/runner/wrangler.jsonc");

function run(args, stdio = "inherit") {
  return new Promise((resolveRun, reject) => {
    const child = spawn("npx", args, {
      cwd: process.cwd(),
      env: process.env,
      stdio,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (stdio === "ignore") resolveRun(code === 0);
      else if (code === 0) resolveRun(true);
      else reject(new Error(`wrangler exited with code ${code ?? "unknown"}`));
    });
  });
}

const exists = await run([
  "wrangler",
  "r2",
  "bucket",
  "info",
  "byoa-state",
  "--json",
  "--config",
  config,
], "ignore");

if (exists) {
  console.log("private state bucket ready");
} else {
  console.log("creating private state bucket");
  await run([
    "wrangler",
    "r2",
    "bucket",
    "create",
    "byoa-state",
    "--config",
    config,
  ]);
}
