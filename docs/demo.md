# demo

The demo is a real BYOA client, not a simulation. It requests a short-lived session from a Pages Function, starts Codex device login, reads the user's models and provider capabilities, creates an ephemeral read-only thread, and renders streamed text and image-generation items.

The ready state includes a logout control. It calls Codex `account/logout`, removes the persisted account session, closes the runner connection, and returns the browser to the protected connect screen.

Text mode renders `item/agentMessage/delta`. Image mode asks Codex to use its built-in image-generation tool and renders the final `imageGeneration` item from `item/completed`. The image option stays disabled when the signed-in provider reports no image-generation capability.

It remains offline until the runner and Turnstile verifier are deployed and these Pages values are configured:

```bash
npx wrangler pages secret put BYOA_URL --project-name=byoa-demo
npx wrangler pages secret put BYOA_APP_SECRET --project-name=byoa-demo
npx wrangler pages secret put DEMO_COOKIE_SECRET --project-name=byoa-demo
```

Set `TURNSTILE_VERIFY_URL` on the Pages project to the managed siteverify Worker URL. Set `TURNSTILE_SITE_KEY` as a GitHub Actions variable so Vite can render the public widget. The widget action is fixed to `turnstile-spin-v1` and the Pages Function rejects missing, expired, replayed, or wrong-action tokens before it requests paid compute.

Use the runner Worker origin for `BYOA_URL`. Use the same backend secret created during runner deployment for `BYOA_APP_SECRET`. Generate a separate high-entropy value for `DEMO_COOKIE_SECRET`.

Build and deploy from `apps/demo`:

```bash
npm run build
npx wrangler pages deploy dist --project-name=byoa-demo --branch=main
```

The function gives each browser a signed anonymous identity and never exposes runner credentials to the client. Turnstile gates session creation; the runner also enforces 5 session issuances per anonymous user per minute and 20 connection attempts per sandbox per minute.
