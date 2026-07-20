# security

The runner executes model-directed shell commands. Treat every repository, prompt, dependency, and generated file as untrusted.

## invariants

1. one sandbox per installation, user, and workspace
2. no deployment secret in the browser
3. no shared `CODEX_HOME`
4. no credential files in `/workspace`
5. no public app-server port
6. explicit approval for privileged actions
7. short-lived browser session tokens
8. privileged custom tools run behind a trusted backend or authenticated MCP server

## custom tools

Codex dynamic tools are bidirectional: app-server sends `item/tool/call` to its connected client and waits for a response. Treat browser handlers as untrusted, user-visible tools only. They must not contain deployment secrets, database credentials, or cross-tenant authority.

Until the signed backend tool router is implemented, use authenticated MCP for privileged tools or build an app backend endpoint that independently authenticates the user, validates every argument, and derives tenant identity from the server session rather than tool input.

Before release, validate that a hostile prompt cannot read `CODEX_HOME`, other sandboxes, Worker secrets, or R2 credentials.
