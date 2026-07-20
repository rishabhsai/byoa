# BYOA

bring your own agent.

BYOA runs your users' Codex app-server in the cloud. They sign in with ChatGPT. You do not carry one shared API bill.

[site](https://byoa-3ln.pages.dev) · [demo](https://byoa-demo.pages.dev) · [agent setup](https://byoa-3ln.pages.dev/agent)

```bash
curl -fsSL https://byoa-3ln.pages.dev/agent
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
npx byoa deploy
npm install byoa
```

Import the browser client from `byoa`, the trusted backend helper from `byoa/server`, or the optional React connection UI from `byoa/react`.

The `byoa` package is ready for its first npm publish. This machine still needs npm login before that command becomes available from the public registry.

## repository development

```bash
npm install
npm run dev
```

The Cloudflare runner requires Workers Paid and Containers access. See [docs/deploy.md](docs/deploy.md).

The example chat app is deployed separately and stays in an explicit offline state until its runner secrets are configured. See [docs/demo.md](docs/demo.md).

Production releases run through [GitHub Actions](.github/workflows/deploy.yml), including the Docker build for the Cloudflare runner. Local Docker is not required to release this repository.

## deploy

Repository contributors can also deploy the checked-out source:

```bash
npm run deploy
```

The command creates the runner secret when needed and deploys into your Cloudflare account. A scoped `CLOUDFLARE_API_TOKEN` also works in CI; no global API key belongs in BYOA.

## status

early. the site and protocol surface are usable; hosted Codex authentication and persistence still require production validation before release.
