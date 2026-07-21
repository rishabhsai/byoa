import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { SingleConnectionQueue } from "./connection-queue.mjs";
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
const maxQueuedBytes = 16 * 1024 * 1024;
const maxQueuedMessages = 1_000;

function appServerErrorCategory(stderr, spawnError) {
  if (spawnError) return "spawn";
  const value = stderr.toLowerCase();
  if (!value.trim()) return "none";
  if (value.includes("permission denied")) return "filesystem_permission";
  if (value.includes("auth") || value.includes("credential") || value.includes("token")) return "authentication";
  if (value.includes("already in use") || value.includes("resource busy") || value.includes("lock")) return "resource_conflict";
  if (value.includes("panic") || value.includes("fatal")) return "fatal";
  return "stderr";
}

function flushCredentials() {
  if (!credentialSync) return;
  void credentialSync.flush().catch((error) => {
    console.error(JSON.stringify({
      event: "credential_sync_failed",
      error: error instanceof Error ? error.message : String(error),
    }));
  });
}

async function runConnection(connection) {
  const { socket, request } = connection;
  if (connection.closed || socket.readyState !== WebSocket.OPEN) return;

  const workspaceAccess = request.headers["x-byoa-workspace-access"] === "workspace-write"
    ? "workspace-write"
    : "read-only";

  await writeFile(`${codexHome}/config.toml`, codexConfig(workspaceAccess), { mode: 0o600 });
  if (connection.closed || socket.readyState !== WebSocket.OPEN) return;

  const codex = spawn("codex", ["app-server", "--stdio"], {
    cwd: "/workspace",
    env: { ...process.env, CODEX_HOME: codexHome },
    stdio: ["pipe", "pipe", "pipe"],
  });
  connection.codex = codex;
  console.log(JSON.stringify({ event: "app_server_started" }));

  let stdout = "";
  let stderr = "";
  let spawnError;
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
            flushCredentials();
          }
        } catch {
          // app-server owns stdout; malformed protocol lines are handled by the client.
        }
      }
      if (line && socket.readyState === WebSocket.OPEN) socket.send(line);
    }
  });

  codex.stderr.setEncoding("utf8");
  codex.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-8_192);
  });
  codex.stdin.on("error", () => {});
  codex.on("error", (error) => {
    spawnError = error;
  });

  const forward = (message) => {
    const guarded = guardClientMessage(message, workspaceAccess);
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
  };
  connection.forward = forward;
  for (const message of connection.messages) {
    if (connection.closed) break;
    forward(message);
  }
  connection.messages = [];
  connection.bytes = 0;

  if (connection.closed) connection.terminate();

  await new Promise((resolve) => codex.once("close", (code, signal) => {
    if (connection.killTimer) clearTimeout(connection.killTimer);
    flushCredentials();
    console.log(JSON.stringify({
      event: "app_server_exited",
      code: code ?? "signal",
      signal: signal ?? "none",
      error: appServerErrorCategory(stderr, spawnError),
    }));
    if (socket.readyState === WebSocket.OPEN) socket.close(1011, `codex exited (${code ?? "signal"})`);
    resolve();
  }));
}

const queue = new SingleConnectionQueue(async (connection) => {
  try {
    await runConnection(connection);
  } catch (error) {
    console.error(JSON.stringify({
      event: "connection_setup_failed",
      error: error instanceof Error ? error.message : String(error),
    }));
    if (connection.socket.readyState === WebSocket.OPEN) connection.socket.close(1011, "runner setup failed");
  }
}, (connection) => {
  if (connection.socket.readyState === WebSocket.OPEN) connection.socket.close(1013, "runner connection queue is full");
});

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
  const connection = {
    socket,
    request,
    messages: [],
    bytes: 0,
    closed: false,
    codex: undefined,
    forward: undefined,
    killTimer: undefined,
    terminate() {
      const codex = connection.codex;
      if (!codex || codex.exitCode !== null || codex.signalCode !== null) return;
      codex.kill("SIGTERM");
      connection.killTimer ??= setTimeout(() => {
        if (codex.exitCode === null && codex.signalCode === null) codex.kill("SIGKILL");
      }, 2_000);
      connection.killTimer.unref();
    },
  };

  socket.on("message", (message) => {
    const raw = String(message);
    if (connection.forward) {
      connection.forward(raw);
      return;
    }
    connection.bytes += Buffer.byteLength(raw);
    connection.messages.push(raw);
    if (connection.bytes > maxQueuedBytes || connection.messages.length > maxQueuedMessages) {
      socket.close(1009, "connection queue exceeded");
    }
  });

  const close = () => {
    if (connection.closed) return;
    connection.closed = true;
    if (!queue.cancel(connection)) connection.terminate();
  };
  socket.on("close", close);
  socket.on("error", close);
  queue.enqueue(connection);
});

server.listen(port, "0.0.0.0", () => console.log(`byoa supervisor listening on ${port}`));
