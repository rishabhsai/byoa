# byoa

bring your own agent.

run your users' Codex app-server in your Cloudflare account. they sign in with ChatGPT. no shared API key.

[site](https://byoa.lol) · [docs](https://byoa.lol/docs) · [demo](https://demo.byoa.lol) · [source](https://github.com/rishabhsai/byoa)

```bash
npx @rishabhsai/byoa deploy
npm install @rishabhsai/byoa
```

```ts
import { BYOA } from "@rishabhsai/byoa";
import { BYOAServer } from "@rishabhsai/byoa/server";
import { ConnectAgent } from "@rishabhsai/byoa/react";
```

Create browser sessions only from a trusted backend. The backend fixes workspace access for the whole connection:

```ts
const session = await server.createSession({
  installationId: "your-app",
  userId: signedInUser.id,
  workspaceId: project.id,
  workspaceAccess: "read-only", // or "workspace-write"
});
```

Model choices come from each signed-in Codex account:

```ts
const { data: models } = await client.listModels();
await client.startTurn(threadId, "hello", {
  model: models[0].model,
  effort: models[0].defaultReasoningEffort,
});
```

Revoke the persisted ChatGPT session with `await client.logout()`.

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

Other surfaces include `client.mcp`, `client.extensions`, `client.models.capabilities()`, server-initiated request events, and raw `request()` calls for methods admitted by the runner firewall.

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

the deploy command requires Node.js 20+, Cloudflare Workers Paid, Containers, R2, and Wrangler OAuth or `CLOUDFLARE_API_TOKEN`. Codex login state is R2-backed; `/workspace` remains ephemeral in 0.2.0.
