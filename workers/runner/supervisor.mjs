import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

const port = Number(process.env.BYOA_SUPERVISOR_PORT ?? 8787);
const codexHome = process.env.CODEX_HOME ?? "/var/lib/byoa/codex";
await mkdir(codexHome, { recursive: true });
await mkdir("/workspace", { recursive: true });

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  response.writeHead(404);
  response.end();
});

const sockets = new WebSocketServer({ server });
let active = false;

sockets.on("connection", (socket) => {
  if (active) {
    socket.close(1013, "runner already connected");
    return;
  }
  active = true;

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
      if (line && socket.readyState === WebSocket.OPEN) socket.send(line);
    }
  });

  codex.stderr.resume();

  socket.on("message", (message) => {
    if (codex.stdin.writable) codex.stdin.write(`${String(message)}\n`);
  });

  const close = () => {
    if (!codex.killed) codex.kill("SIGTERM");
    active = false;
  };
  socket.on("close", close);
  socket.on("error", close);
  codex.on("exit", (code) => {
    if (socket.readyState === WebSocket.OPEN) socket.close(1011, `codex exited (${code ?? "signal"})`);
    active = false;
  });
});

server.listen(port, "0.0.0.0", () => console.log(`byoa supervisor listening on ${port}`));
