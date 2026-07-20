# BYOA

bring your own agent.

BYOA is an open deployment kit for adding user-authorized coding agents to developer products. Developers deploy the runner to their own Cloudflare account. Users connect their own supported agent account.

```bash
curl -fsSL https://byoa-3ln.pages.dev/agent
```

## repository

```text
apps/site          landing page and docs
packages/sdk       browser/server protocol client
packages/react     small React bindings
workers/runner     Cloudflare Sandbox control plane
docs               architecture and security notes
```

## local development

```bash
npm install
npm run dev
```

The Cloudflare runner requires Workers Paid and Containers access. See [docs/deploy.md](docs/deploy.md).

## deploy

Authenticate Wrangler, then run:

```bash
npm run deploy
```

The command creates the runner secret when needed and deploys into your Cloudflare account. A scoped `CLOUDFLARE_API_TOKEN` also works in CI; no global API key belongs in BYOA.

## status

early. the site and protocol surface are usable; hosted Codex authentication and persistence still require production validation before release.
