# architecture

BYOA has three boundaries:

```text
developer app -> byoa worker -> per-user Cloudflare sandbox -> codex app-server
```

The developer backend authenticates to the BYOA Worker with a deployment secret and requests a short-lived session token. The browser uses only that token. The Worker derives a sandbox identity from the installation, user, and workspace tuple, then proxies an authenticated WebSocket to a private supervisor inside the sandbox.

The supervisor owns one `codex app-server --stdio` child process. A protocol firewall allowlists the app-server methods exposed to the browser, fixes Codex's permission profile, and keeps filesystem requests under `/workspace`. Codex's experimental network listener is never exposed.

## runtime surface

BYOA keeps Codex app-server as the agent runtime instead of replacing it with a chat protocol.

```text
app input -> threads + turns -> codex app-server -> streamed items -> app UI
                  |                   |
            files + schema       tools + hooks
```

The SDK has typed namespaces for threads, turns, workspace files, models, MCP, skills, and hooks. It also exposes raw requests, notifications, events, and server-initiated requests inside the runner allowlist. New app-server methods require an explicit security decision before the firewall admits them.

Dynamic tools are experimental in Codex. The app-server asks its connected client to execute them with `item/tool/call`. BYOA can answer browser-safe tools today. Privileged app tools need the planned signed backend router, or an authenticated MCP server, so secrets never enter browser code.

## state

- `/workspace`: ephemeral repository and generated files.
- `/var/lib/byoa/codex`: per-sandbox `CODEX_HOME`, mounted from R2.
- Worker state: session authorization and runner metadata.
- R2: one private prefix per derived sandbox identity for Codex login state.
- Workspace snapshots (planned): a separate backup and restore path, not a credential-bucket mount.

The mount is the credential-persistence mechanism in 0.2.0. Durability is still labeled beta until device login survives a sandbox replacement in the paid account. Workspace durability is not implemented.

## request controls

The application backend is the only caller of `POST /v1/sessions`. It authenticates with `BYOA_APP_SECRET`; the browser never sees that secret. Session tokens expire after 60–900 seconds and authorize one derived sandbox identity.

The production Worker has separate session and WebSocket rate-limit bindings, a secret-backed emergency stop, and structured observability. The public demo additionally verifies a single-use Turnstile token before asking the runner to create a session.

The backend chooses `read-only` or `workspace-write` when it creates a session. Browser thread and turn requests cannot broaden that access or replace the fixed Codex permission profile.
