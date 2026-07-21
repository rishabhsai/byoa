# security

The runner executes model-directed shell commands. Treat every repository, prompt, dependency, and generated file as untrusted.

## invariants

1. one sandbox per installation, user, and workspace
2. no deployment secret in the browser
3. no shared `CODEX_HOME`
4. no credential files in `/workspace`
5. no public app-server port
6. one fixed Codex permission profile per session
7. short-lived browser session tokens
8. privileged custom tools run behind a trusted backend or authenticated MCP server
9. public paid-compute entry points require server-verified Turnstile
10. session and connection routes are rate limited independently

## protocol boundary

The browser does not receive unrestricted app-server access. The supervisor allowlists supported methods, rejects full-access methods such as `thread/shellCommand`, constrains app-server filesystem calls to `/workspace`, and removes permission overrides from thread and turn requests.

Codex starts with `approval_policy = "never"` and a fixed permission profile. Shell tools can access `/workspace` according to the server-issued session mode, cannot access `/var/lib/byoa/codex`, and have network access disabled. The browser cannot change those rules.

These controls reduce the reachable surface; they are not yet a hostile-workload security claim. Symlink behavior, new app-server methods, MCP authority, and container escape boundaries still require adversarial review.

## custom tools

Codex dynamic tools are bidirectional: app-server sends `item/tool/call` to its connected client and waits for a response. Treat browser handlers as untrusted, user-visible tools only. They must not contain deployment secrets, database credentials, or cross-tenant authority.

Until the signed backend tool router is implemented, use authenticated MCP for privileged tools or build an app backend endpoint that independently authenticates the user, validates every argument, and derives tenant identity from the server session rather than tool input.

Before a production isolation claim, validate that a hostile prompt cannot read `CODEX_HOME`, other sandboxes, Worker secrets, or R2 credentials.

## operations

Structured Worker logs must not include prompts, protocol payloads, credentials, or full external user IDs. The runner logs lifecycle outcomes against a truncated derived sandbox identifier.

`BYOA_DISABLED=1` is the emergency stop. It blocks new session and connection requests with `503` while leaving health checks online. Cloudflare Rate Limiting bindings return `429` and `Retry-After: 60`; they reduce abuse but are not a billing ledger or strict quota system.

Turnstile is defense in depth for the public demo. The browser sitekey is public. The secret exists only in the managed siteverify Worker, and the demo Pages Function accepts a token only when server-side verification succeeds with action `turnstile-spin-v1`.
