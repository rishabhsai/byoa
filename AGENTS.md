# BYOA agent guide

Keep the product small, direct, and honest.

## commands

```bash
npm install
npm run dev
npm run check
npm run build
```

## structure

- `apps/site`: public site and terse documentation.
- `packages/sdk`: framework-free BYOA client.
- `packages/react`: optional React UI bindings.
- `workers/runner`: Cloudflare Worker and Sandbox runtime.
- `docs`: product and security decisions.

## rules

- Never place Cloudflare tokens, BYOA deployment secrets, or Codex credentials in browser code.
- One sandbox is scoped to one installation, user, and workspace.
- Keep `CODEX_HOME` outside `/workspace`.
- Use `codex app-server` over private stdio. Do not expose its experimental WebSocket listener.
- Pin the Codex and Sandbox versions in the container image.
- Do not claim persistence, isolation, or authentication works unless it has been tested in a paid Cloudflare account.
- Copy is lowercase, short, technical, and free of marketing filler.
