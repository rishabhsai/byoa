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

Model choices come from each signed-in Codex account:

```ts
const { data: models } = await client.listModels();
await client.startTurn(threadId, "hello", {
  model: models[0].model,
  effort: models[0].defaultReasoningEffort,
});
```

BYOA exposes the agent runtime, not only chat:

```ts
await client.workspace.write("/workspace/input.txt", input);

const { thread } = await client.threads.start({
  cwd: "/workspace",
  developerInstructions: "return a short risk report",
});

await client.turns.start(thread.id, "review input.txt", {
  outputSchema: riskReportSchema,
});
```

Other surfaces include `client.mcp`, `client.extensions`, `client.models.capabilities()`, server-initiated request events, and the raw `request()` escape hatch.

Dynamic tools use Codex's experimental app-server API:

```ts
const client = new BYOA({ ...session, experimentalApi: true });

const { thread } = await client.threads.start({
  dynamicTools: [{
    type: "function",
    name: "lookup_order",
    description: "look up one order",
    inputSchema: { type: "object", properties: { id: { type: "string" } } },
  }],
});

client.onToolCall(async (call) => ({
  contentItems: [{ type: "inputText", text: await runBrowserSafeTool(call) }],
  success: true,
}));
```

Keep privileged tools behind your backend or an authenticated MCP server.

The deploy command requires Node.js 20+, Cloudflare Workers Paid, Containers, and Wrangler OAuth or `CLOUDFLARE_API_TOKEN`.

[docs](https://byoa-3ln.pages.dev/docs) · [demo](https://byoa-demo.pages.dev) · [source](https://github.com/rishabhsai/byoa)
