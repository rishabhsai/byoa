import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = join(packageDirectory, "..", "..");
const runnerSource = join(repositoryRoot, "workers", "runner");
const runnerOutput = join(packageDirectory, "dist", "runner");

await rm(runnerOutput, { recursive: true, force: true });
await mkdir(join(runnerOutput, "src"), { recursive: true });

await Promise.all([
  cp(join(runnerSource, "Dockerfile"), join(runnerOutput, "Dockerfile")),
  cp(join(runnerSource, "package.json"), join(runnerOutput, "package.json")),
  cp(join(runnerSource, "protocol-guard.mjs"), join(runnerOutput, "protocol-guard.mjs")),
  cp(join(runnerSource, "protocol-guard.test.mjs"), join(runnerOutput, "protocol-guard.test.mjs")),
  cp(join(runnerSource, "supervisor.mjs"), join(runnerOutput, "supervisor.mjs")),
  cp(join(runnerSource, "tsconfig.json"), join(runnerOutput, "tsconfig.json")),
  cp(join(runnerSource, "wrangler.jsonc"), join(runnerOutput, "wrangler.jsonc")),
  cp(join(runnerSource, "src", "index.ts"), join(runnerOutput, "src", "index.ts")),
]);
