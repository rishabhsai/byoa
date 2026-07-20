import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { BYOAServer } from "./server.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("creates a session through the trusted runner endpoint", async () => {
  let captured: { input: string | URL | Request | undefined; init: RequestInit | undefined } = { input: undefined, init: undefined };
  globalThis.fetch = async (input, init) => {
    captured = { input, init };
    return Response.json({ token: "session", expiresAt: 42, endpoint: "https://runner.example" });
  };

  const server = new BYOAServer({ endpoint: "https://runner.example/", secret: "backend-secret" });
  const session = await server.createSession({ installationId: "app", userId: "user", workspaceId: "work" });

  assert.equal(captured.input, "https://runner.example/v1/sessions");
  assert.equal(new Headers(captured.init?.headers).get("authorization"), "Bearer backend-secret");
  assert.deepEqual(JSON.parse(String(captured.init?.body)), {
    installationId: "app",
    userId: "user",
    workspaceId: "work",
  });
  assert.equal(session.token, "session");
});

test("surfaces runner rate-limit failures", async () => {
  globalThis.fetch = async () => new Response('{"error":"rate limit exceeded"}', { status: 429 });
  const server = new BYOAServer({ endpoint: "https://runner.example", secret: "backend-secret" });

  await assert.rejects(
    server.createSession({ installationId: "app", userId: "user", workspaceId: "work" }),
    /BYOA session failed \(429\).*rate limit exceeded/,
  );
});
