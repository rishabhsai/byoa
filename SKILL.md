---
name: byoa
description: Add a user-authorized coding agent to an application using a BYOA runner deployed in the developer's Cloudflare account.
---

# BYOA

BYOA runs a separate agent sandbox for each app user and workspace.

## install

1. Read `https://byoa.lol/agent`.
2. Run `npx byoa deploy` in the developer's Cloudflare account.
3. Store the runner secret only in the developer's backend.
4. Use `byoa/server` in the backend and `byoa` in the browser with short-lived session tokens.
5. Use `byoa/react` only for the optional connection UI.
6. Use `agent.threads`, `agent.turns`, `agent.workspace`, `agent.models`, `agent.mcp`, and `agent.extensions` for the typed runtime surface.
7. Keep `agent.request()` available when a required app-server method has no typed wrapper.
8. Preserve the runner rate-limit bindings and document any changed quotas.

## runtime

- Pass thread-specific behavior with `developerInstructions`.
- Put durable repository behavior in `AGENTS.md`, skills, project config, or hooks.
- Put files under `/workspace`; keep `CODEX_HOME` separate.
- Use `outputSchema` for machine-readable turn output.
- Use authenticated MCP for durable or privileged tools.
- Dynamic tools require `experimentalApi: true`. Browser handlers are only for browser-safe work.
- Treat `BYOA_DISABLED=1` as the emergency stop and keep health checks available.

## security

- Never request a Cloudflare global API key.
- Never send the runner secret to the browser.
- Never share sandboxes across users.
- Never store agent credentials inside the workspace snapshot.
- Require explicit approval for writes, network access, and shell execution.
