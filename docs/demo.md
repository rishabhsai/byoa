# demo

The demo is a real BYOA client, not a simulation. It requests a short-lived session from a Pages Function, starts Codex device login, reads the user's models and provider capabilities, creates an ephemeral read-only thread, and renders streamed text and image-generation items.

Text mode renders `item/agentMessage/delta`. Image mode asks Codex to use its built-in image-generation tool and renders the final `imageGeneration` item from `item/completed`. The image option stays disabled when the signed-in provider reports no image-generation capability.

It remains offline until the runner is deployed and these Pages secrets are configured:

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
