import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { restoreCredentials, watchCredentials } from "./credential-store.mjs";
import { codexConfig, guardClientMessage } from "./protocol-guard.mjs";

const port = Number(process.env.BYOA_SUPERVISOR_PORT ?? 8787);
const codexHome = process.env.CODEX_HOME ?? "/var/lib/byoa/codex";
const persistedCodexHome = process.env.BYOA_PERSISTED_CODEX_HOME;
await mkdir(codexHome, { recursive: true });
await mkdir("/workspace", { recursive: true });

let credentialSync;
if (persistedCodexHome) {
  const restored = await restoreCredentials(codexHome, persistedCodexHome);
  console.log(JSON.stringify({ event: "credential_state_ready", restored }));
  credentialSync = watchCredentials(codexHome, persistedCodexHome, (error) => {
    console.error(JSON.stringify({
      event: "credential_sync_failed",
      error: error instanceof Error ? error.message : String(error),
    }));
  });
}

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  response.writeHead(404);
  response.end();
});

const sockets = new WebSocketServer({ server, maxPayload: 16 * 1024 * 1024 });
let active = false;

async function connect(socket, request) {
  if (active) {
    socket.close(1013, "runner already connected");
    return;
  }
  active = true;

  const workspaceAccess = request.headers["x-byoa-workspace-access"] === "workspace-write"
    ? "workspace-write"
    : "read-only";

  await writeFile(`${codexHome}/config.toml`, codexConfig(workspaceAccess), { mode: 0o600 });

  const codex = spawn("codex", ["app-server", "--stdio"], {
    cwd: "/workspace",
    env: { ...process.env, CODEX_HOME: codexHome },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  codex.stdout.setEncoding("utf8");
  codex.stdout.on("data", (chunk) => {
    stdout += chunk;
    while (stdout.includes("\n")) {
      const newline = stdout.indexOf("\n");
      const line = stdout.slice(0, newline).trim();
      stdout = stdout.slice(newline + 1);
      if (line && credentialSync) {
        try {
          const event = JSON.parse(line);
          if (event.method === "account/login/completed" && event.params?.success !== false) {
            void credentialSync.flush();
          }
        } catch {
          // app-server owns stdout; malformed protocol lines are handled by the client.
        }
      }
      if (line && socket.readyState === WebSocket.OPEN) socket.send(line);
    }
  });

  codex.stderr.resume();

  socket.on("message", (message) => {
    const guarded = guardClientMessage(String(message), workspaceAccess);
    if (guarded.action === "close") {
      socket.close(guarded.code, guarded.reason);
      return;
    }
    if (guarded.action === "respond") {
      if (socket.readyState === WebSocket.OPEN) socket.send(guarded.message);
      console.warn(JSON.stringify({ event: "protocol_method_denied", method: guarded.deniedMethod ?? "unknown" }));
      return;
    }
    if (codex.stdin.writable) codex.stdin.write(`${guarded.message}\n`);
  });

  const close = () => {
    if (!codex.killed) codex.kill("SIGTERM");
    active = false;
  };
  socket.on("close", close);
  socket.on("error", close);
  codex.on("exit", (code) => {
    void credentialSync?.flush();
    if (socket.readyState === WebSocket.OPEN) socket.close(1011, `codex exited (${code ?? "signal"})`);
    active = false;
  });
}

if (credentialSync) {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      const deadline = setTimeout(() => process.exit(0), 2_000);
      deadline.unref();
      void credentialSync.flush().finally(() => {
        clearTimeout(deadline);
        credentialSync.close();
        process.exit(0);
      });
    });
  }
}

sockets.on("connection", (socket, request) => {
  void connect(socket, request).catch((error) => {
    console.error(JSON.stringify({
      event: "connection_setup_failed",
      error: error instanceof Error ? error.message : String(error),
    }));
    active = false;
    if (socket.readyState === WebSocket.OPEN) socket.close(1011, "runner setup failed");
  });
});

server.listen(port, "0.0.0.0", () => console.log(`byoa supervisor listening on ${port}`));
