# demo

The demo is a real BYOA client, not a simulated chat. It requests a short-lived session from a Pages Function, starts Codex device login, creates an ephemeral read-only thread, and renders streamed agent message deltas.

It remains offline until the runner is deployed and these Pages secrets are configured:

The current Cloudflare account does not have Workers Paid, so Cloudflare rejects the container rollout. The image itself builds successfully. Enable Workers Paid before configuring the secrets below.

```bash
npx wrangler pages secret put BYOA_URL --project-name=byoa-demo
npx wrangler pages secret put BYOA_APP_SECRET --project-name=byoa-demo
npx wrangler pages secret put DEMO_COOKIE_SECRET --project-name=byoa-demo
```

Use the runner Worker origin for `BYOA_URL`. Use the same backend secret created during runner deployment for `BYOA_APP_SECRET`. Generate a separate high-entropy value for `DEMO_COOKIE_SECRET`.

Build and deploy from `apps/demo`:

```bash
npm run build
npx wrangler pages deploy dist --project-name=byoa-demo --branch=main
```

The function gives each browser a signed anonymous identity and never exposes runner credentials to the client. Add abuse controls before connecting a public demo to paid compute; a signed browser identity is isolation, not rate limiting.
