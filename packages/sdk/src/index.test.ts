import assert from "node:assert/strict";
import test from "node:test";
import { BYOA } from "./index.js";

class TestSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  readyState = TestSocket.CONNECTING;

  close() {
    this.readyState = TestSocket.CLOSED;
  }

  send() {}
}

async function withSocket(socket: typeof TestSocket, run: () => Promise<void>) {
  const original = globalThis.WebSocket;
  globalThis.WebSocket = socket as unknown as typeof WebSocket;
  try {
    await run();
  } finally {
    globalThis.WebSocket = original;
  }
}

test("connect stops waiting for a runner that never opens", async () => {
  await withSocket(TestSocket, async () => {
    const client = new BYOA({ endpoint: "https://runner.example", token: "session", connectTimeoutMs: 10 });
    await assert.rejects(client.connect(), /runner connection timed out/);
  });
});

test("initialize stops waiting for an app-server response", async () => {
  class OpenSocket extends TestSocket {
    constructor() {
      super();
      queueMicrotask(() => {
        this.readyState = TestSocket.OPEN;
        this.dispatchEvent(new Event("open"));
      });
    }
  }

  await withSocket(OpenSocket, async () => {
    const client = new BYOA({ endpoint: "https://runner.example", token: "session", requestTimeoutMs: 10 });
    await assert.rejects(client.connect(), /initialize timed out/);
    client.close();
  });
});
