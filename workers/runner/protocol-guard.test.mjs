import assert from "node:assert/strict";
import test from "node:test";
import { codexConfig, guardClientMessage } from "./protocol-guard.mjs";

function request(method, params = {}, id = 1) {
  return JSON.stringify({ id, method, params });
}

test("blocks full-access app-server methods", () => {
  for (const method of ["thread/shellCommand", "command/exec", "process/spawn", "config/value/write"]) {
    const result = guardClientMessage(request(method));
    assert.equal(result.action, "respond");
    assert.match(JSON.parse(result.message).error.message, /not available through BYOA/);
  }
});

test("keeps filesystem requests inside the workspace", () => {
  const denied = guardClientMessage(request("fs/readFile", { path: "/var/lib/byoa/codex/auth.json" }));
  assert.equal(denied.action, "respond");

  const allowed = guardClientMessage(request("fs/readFile", { path: "/workspace/docs/../README.md" }));
  assert.equal(allowed.action, "forward");
  assert.equal(JSON.parse(allowed.message).params.path, "/workspace/README.md");
});

test("enforces read-only sessions", () => {
  const denied = guardClientMessage(request("fs/writeFile", { path: "/workspace/a.txt", dataBase64: "YQ==" }), "read-only");
  assert.equal(denied.action, "respond");

  const allowed = guardClientMessage(request("fs/writeFile", { path: "/workspace/a.txt", dataBase64: "YQ==" }), "workspace-write");
  assert.equal(allowed.action, "forward");
});

test("strips permission overrides from thread and turn requests", () => {
  const thread = guardClientMessage(request("thread/start", {
    cwd: "/workspace/app",
    sandbox: "danger-full-access",
    approvalPolicy: "never",
    config: { model_provider: "other" },
  }), "workspace-write");
  const threadParams = JSON.parse(thread.message).params;
  assert.equal(threadParams.cwd, "/workspace/app");
  assert.equal(threadParams.sandbox, undefined);
  assert.equal(threadParams.config, undefined);

  const turn = guardClientMessage(request("turn/start", {
    threadId: "thread",
    input: [],
    sandboxPolicy: { type: "dangerFullAccess" },
  }), "workspace-write");
  assert.equal(JSON.parse(turn.message).params.sandboxPolicy, undefined);

  const resume = guardClientMessage(request("thread/resume", { threadId: "thread" }));
  assert.equal(JSON.parse(resume.message).params.cwd, undefined);
});

test("only allows device login", () => {
  const denied = guardClientMessage(request("account/login/start", { type: "apiKey", apiKey: "secret" }));
  assert.equal(denied.action, "respond");

  const allowed = guardClientMessage(request("account/login/start", { type: "chatgptDeviceCode", extra: "drop" }));
  assert.deepEqual(JSON.parse(allowed.message).params, { type: "chatgptDeviceCode" });
});

test("forwards responses to server-initiated requests", () => {
  const response = guardClientMessage(JSON.stringify({ id: 9, result: { success: true } }));
  assert.equal(response.action, "forward");
});

test("writes a locked Codex permission profile", () => {
  const writable = codexConfig("workspace-write");
  assert.match(writable, /"\/workspace" = "write"/);
  assert.match(writable, /"\/var\/lib\/byoa\/codex" = "deny"/);
  assert.match(writable, /"\/mnt\/byoa-state" = "deny"/);
  assert.match(writable, /approval_policy = "never"/);
});
