---
name: byoa
description: Add a user-authorized coding agent to an application using a BYOA runner deployed in the developer's Cloudflare account.
---

# BYOA

BYOA runs a separate agent sandbox for each app user and workspace.

## install

1. Read `https://byoa-3ln.pages.dev/agent`.
2. Run `npx byoa deploy` in the developer's Cloudflare account.
3. Store the runner secret only in the developer's backend.
4. Use `byoa/server` in the backend and `byoa` in the browser with short-lived session tokens.
5. Use `byoa/react` only for the optional connection UI.

## security

- Never request a Cloudflare global API key.
- Never send the runner secret to the browser.
- Never share sandboxes across users.
- Never store agent credentials inside the workspace snapshot.
- Require explicit approval for writes, network access, and shell execution.
