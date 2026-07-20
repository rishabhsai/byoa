# byoa

Run your users' Codex app-server in your Cloudflare account. They sign in with ChatGPT. No shared API key.

```bash
npx byoa deploy
npm install byoa
```

```ts
import { BYOA } from "byoa";
import { BYOAServer } from "byoa/server";
import { ConnectAgent } from "byoa/react";
```

The deploy command requires Node.js 20+, Cloudflare Workers Paid, Containers, and Wrangler OAuth or `CLOUDFLARE_API_TOKEN`.

[docs](https://byoa-3ln.pages.dev/docs) · [demo](https://byoa-demo.pages.dev) · [source](https://github.com/rishabhsai/byoa)
