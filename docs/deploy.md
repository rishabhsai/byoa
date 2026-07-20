# deploy

## requirements

- Node.js 20+
- a Cloudflare account on Workers Paid
- Containers enabled
- R2 enabled before turning on durable credential and workspace persistence
- Wrangler authenticated with OAuth or a scoped token

Do not paste a Cloudflare global API key into BYOA.

## current source deployment

```bash
npm install
npm run deploy
```

The command uses Wrangler OAuth or `CLOUDFLARE_API_TOKEN`, creates a strong `BYOA_APP_SECRET` when needed, and deploys the runner. Save the resulting Worker URL and secret only in your server environment. Your server exchanges its deployment secret for short-lived browser session tokens.

The alpha runner is ephemeral today. A sleeping or replaced sandbox can require the user to reconnect. Treat durable account state as unfinished until the documented R2 persistence path is implemented and reviewed.
