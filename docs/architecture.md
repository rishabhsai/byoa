# architecture

BYOA has three boundaries:

```text
developer app -> byoa worker -> per-user Cloudflare sandbox -> codex app-server
```

The developer backend authenticates to the BYOA Worker with a deployment secret and requests a short-lived session token. The browser uses only that token. The Worker derives a sandbox identity from the installation, user, and workspace tuple, then proxies an authenticated WebSocket to a private supervisor inside the sandbox.

The supervisor owns one `codex app-server --stdio` child process. It forwards JSON-RPC messages without exposing Codex's experimental network listener.

## state

- `/workspace`: repository and generated files.
- `/var/lib/byoa/codex`: per-user `CODEX_HOME`.
- Worker state: session authorization and runner metadata.
- R2 (planned): separate encrypted backups for workspace and credential state.

The alpha runner is ephemeral. Durable storage is intentionally not claimed until credential and workspace persistence can be isolated, encrypted, and reviewed.
