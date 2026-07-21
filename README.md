# BYOA

bring your own agent.

BYOA runs your users' Codex app-server in the cloud. They sign in with ChatGPT. You do not carry one shared API bill.

[site](https://byoa.lol) · [docs](https://byoa.lol/docs) · [demo](https://demo.byoa.lol) · [npm](https://www.npmjs.com/package/@rishabhsai/byoa) · [agent setup](https://byoa.lol/agent)

```bash
curl -fsSL https://byoa.lol/agent
```

## repository

```text
apps/site          landing page and docs
apps/demo          example chat integration
packages/sdk       npm client, React binding, and deploy CLI
workers/runner     Cloudflare Sandbox control plane
docs               architecture and security notes
```

## use it in an app

No clone is required.

```bash
npx @rishabhsai/byoa deploy
npm install @rishabhsai/byoa
```

Import the browser client from `@rishabhsai/byoa`, the trusted backend helper from `@rishabhsai/byoa/server`, or the optional React connection UI from `@rishabhsai/byoa/react`.

The package name is `@rishabhsai/byoa`. The deploy command carries the runner template, so app developers do not clone this repository.

## repository development

```bash
npm install
npm run dev
```

The Cloudflare runner requires Workers Paid and Containers access. See [docs/deploy.md](docs/deploy.md).

The example app is deployed separately. It streams text, reads model choices from the signed-in user's Codex account, and renders Codex image-generation items. See [docs/demo.md](docs/demo.md).

## agent runtime

BYOA is not a chat abstraction. The browser SDK exposes typed thread, turn, workspace, model, MCP, skill, hook, and server-request helpers. Raw `request()` and protocol events remain available inside the runner's browser-safe method allowlist.

```ts
await agent.workspace.write("/workspace/input.txt", input);
const { thread } = await agent.threads.start({
  cwd: "/workspace",
  developerInstructions: "return a short risk report",
});
await agent.turns.start(thread.id, "review input.txt", {
  outputSchema: riskReportSchema,
});
```

Experimental dynamic tools can be registered on `thread/start`. Browser-safe handlers use `agent.onToolCall()`. Privileged tools belong behind the developer backend or an authenticated MCP server; the signed backend tool router is not finished.

Production releases run through [GitHub Actions](.github/workflows/deploy.yml), including the Docker build for the Cloudflare runner. Local Docker is not required to release this repository.

## deploy

Repository contributors can also deploy the checked-out source:

```bash
npm run deploy
```

The command creates the runner secret when needed and deploys into your Cloudflare account. A scoped `CLOUDFLARE_API_TOKEN` also works in CI; no global API key belongs in BYOA.

The runner limits session creation to 5 per user per minute and connection attempts to 20 per sandbox per minute. Set the Worker secret `BYOA_DISABLED=1` for an emergency stop; health checks remain available. See [docs/launch.md](docs/launch.md) for the production checklist and domain setup.

## status

0.2.0 is an alpha release candidate. Codex runs on local sandbox storage while its login file is restored from and synced to a sandbox-scoped R2 prefix. Browser protocol access is allowlisted. `/workspace` is still ephemeral, and credential durability and hostile-workload isolation remain unclaimed until restart and adversarial tests pass in the paid Cloudflare account.
