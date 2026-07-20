# deploy

## requirements

- Node.js 20+
- a Cloudflare account on Workers Paid
- Containers enabled
- R2 enabled before turning on durable credential and workspace persistence
- Wrangler authenticated with OAuth or a scoped token

Do not paste a Cloudflare global API key into BYOA.

## this repository

Production deploys run in GitHub Actions. The repository needs:

- `CLOUDFLARE_ACCOUNT_ID` as an Actions variable.
- `CLOUDFLARE_API_TOKEN` as an Actions secret, scoped to this account with Workers, Pages, and Containers write access.

Pushing `main` verifies the monorepo, builds the container on GitHub's runner, deploys the Worker, then deploys the site and demo. Local Docker is not part of this repository's release path.

## package deployment

App developers do not need to clone the repository:

```bash
npx byoa deploy
```

The package carries the runner template and deploys it from a temporary directory. It does not leave a generated project in the app repository.

## source deployment

```bash
npm install
npm run deploy
```

Both commands use Wrangler OAuth or `CLOUDFLARE_API_TOKEN`, create a strong `BYOA_APP_SECRET` when needed, and deploy the runner. Save the resulting Worker URL and secret only in your server environment. Your server exchanges its deployment secret for short-lived browser session tokens.

The alpha runner is ephemeral today. A sleeping or replaced sandbox can require the user to reconnect. Treat durable account state as unfinished until the documented R2 persistence path is implemented and reviewed.
