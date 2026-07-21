import { posix } from "node:path";

const SAFE_METHODS = new Set([
  "initialize",
  "account/read",
  "account/login/start",
  "account/login/cancel",
  "account/logout",
  "account/rateLimits/read",
  "account/usage/read",
  "account/workspaceMessages/read",
  "thread/start",
  "thread/resume",
  "thread/fork",
  "thread/read",
  "thread/list",
  "thread/archive",
  "thread/unarchive",
  "thread/delete",
  "thread/unsubscribe",
  "thread/compact/start",
  "thread/name/set",
  "thread/goal/set",
  "thread/goal/get",
  "thread/goal/clear",
  "turn/start",
  "turn/steer",
  "turn/interrupt",
  "review/start",
  "model/list",
  "modelProvider/capabilities/read",
  "experimentalFeature/list",
  "permissionProfile/list",
  "collaborationMode/list",
  "skills/list",
  "hooks/list",
  "mcpServer/oauth/login",
  "mcpServerStatus/list",
  "mcpServer/resource/read",
  "mcpServer/tool/call",
  "fs/readFile",
  "fs/writeFile",
  "fs/createDirectory",
  "fs/getMetadata",
  "fs/readDirectory",
  "fs/remove",
  "fs/watch",
  "fs/unwatch",
]);

const WORKSPACE_PATH_METHODS = new Set([
  "fs/readFile",
  "fs/writeFile",
  "fs/createDirectory",
  "fs/getMetadata",
  "fs/readDirectory",
  "fs/remove",
  "fs/watch",
]);

const WORKSPACE_WRITE_METHODS = new Set([
  "fs/writeFile",
  "fs/createDirectory",
  "fs/remove",
]);

const THREAD_METHODS = new Set(["thread/start", "thread/resume", "thread/fork"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rpcError(id, message) {
  return JSON.stringify({ id, error: { code: -32004, message } });
}

function workspacePath(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  const normalized = posix.normalize(value);
  if (normalized !== "/workspace" && !normalized.startsWith("/workspace/")) return null;
  return normalized;
}

function safeClientInfo(value) {
  const input = isRecord(value) ? value : {};
  const clean = {};
  for (const key of ["name", "title", "version"]) {
    if (typeof input[key] === "string") clean[key] = input[key].slice(0, 100);
  }
  return clean;
}

function sanitizeInitialize(params) {
  const input = isRecord(params) ? params : {};
  const capabilities = isRecord(input.capabilities) ? input.capabilities : {};
  return {
    clientInfo: safeClientInfo(input.clientInfo),
    capabilities: {
      experimentalApi: capabilities.experimentalApi === true,
      ...(Array.isArray(capabilities.optOutNotificationMethods)
        ? {
            optOutNotificationMethods: capabilities.optOutNotificationMethods
              .filter((method) => typeof method === "string")
              .slice(0, 100),
          }
        : {}),
    },
  };
}

function sanitizeThreadParams(method, params) {
  const clean = { ...(isRecord(params) ? params : {}) };
  if (clean.cwd !== undefined) {
    const cwd = workspacePath(clean.cwd);
    if (!cwd) return null;
    clean.cwd = cwd;
  } else if (method === "thread/start") {
    clean.cwd = "/workspace";
  }
  delete clean.approvalPolicy;
  delete clean.approvalsReviewer;
  delete clean.sandbox;
  delete clean.sandboxPolicy;
  delete clean.config;
  return clean;
}

function sanitizeTurnParams(params) {
  const clean = { ...(isRecord(params) ? params : {}) };
  if (clean.cwd !== undefined) {
    const cwd = workspacePath(clean.cwd);
    if (!cwd) return null;
    clean.cwd = cwd;
  }
  delete clean.approvalPolicy;
  delete clean.approvalsReviewer;
  delete clean.sandbox;
  delete clean.sandboxPolicy;
  return clean;
}

function sanitizeExtensionParams(params) {
  const clean = { ...(isRecord(params) ? params : {}) };
  if (!Array.isArray(clean.cwds)) return null;
  const cwds = clean.cwds.map(workspacePath);
  if (cwds.some((cwd) => cwd === null)) return null;
  clean.cwds = cwds;
  delete clean.perCwdExtraUserRoots;
  return clean;
}

export function guardClientMessage(raw, workspaceAccess = "read-only") {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return { action: "close", code: 1008, reason: "invalid json" };
  }

  if (!isRecord(message)) return { action: "close", code: 1008, reason: "invalid rpc message" };

  if (typeof message.method !== "string") {
    if (message.id === undefined) return { action: "close", code: 1008, reason: "invalid rpc message" };
    return { action: "forward", message: JSON.stringify(message) };
  }

  if (message.id === undefined) {
    if (message.method === "initialized") return { action: "forward", message: JSON.stringify(message) };
    return { action: "close", code: 1008, reason: "notification not allowed" };
  }

  if (!SAFE_METHODS.has(message.method)) {
    return {
      action: "respond",
      message: rpcError(message.id, `${message.method} is not available through BYOA`),
      deniedMethod: message.method,
    };
  }

  let params = message.params;
  if (message.method === "initialize") {
    params = sanitizeInitialize(params);
  } else if (message.method === "account/login/start") {
    if (!isRecord(params) || params.type !== "chatgptDeviceCode") {
      return {
        action: "respond",
        message: rpcError(message.id, "BYOA only allows ChatGPT device login"),
        deniedMethod: message.method,
      };
    }
    params = { type: "chatgptDeviceCode" };
  } else if (THREAD_METHODS.has(message.method)) {
    params = sanitizeThreadParams(message.method, params);
    if (!params) {
      return { action: "respond", message: rpcError(message.id, "cwd must stay under /workspace"), deniedMethod: message.method };
    }
  } else if (message.method === "turn/start") {
    params = sanitizeTurnParams(params);
    if (!params) {
      return { action: "respond", message: rpcError(message.id, "cwd must stay under /workspace"), deniedMethod: message.method };
    }
  } else if (message.method === "skills/list" || message.method === "hooks/list") {
    params = sanitizeExtensionParams(params);
    if (!params) {
      return { action: "respond", message: rpcError(message.id, "extension roots must stay under /workspace"), deniedMethod: message.method };
    }
  } else if (WORKSPACE_PATH_METHODS.has(message.method)) {
    if (!isRecord(params)) {
      return { action: "respond", message: rpcError(message.id, "invalid filesystem request"), deniedMethod: message.method };
    }
    const path = workspacePath(params.path);
    if (!path) {
      return { action: "respond", message: rpcError(message.id, "filesystem access must stay under /workspace"), deniedMethod: message.method };
    }
    if (workspaceAccess !== "workspace-write" && WORKSPACE_WRITE_METHODS.has(message.method)) {
      return { action: "respond", message: rpcError(message.id, "this session is read-only"), deniedMethod: message.method };
    }
    params = { ...params, path };
  }

  return { action: "forward", message: JSON.stringify({ ...message, params }) };
}

export function codexConfig(workspaceAccess = "read-only") {
  const access = workspaceAccess === "workspace-write" ? "write" : "read";
  return `approval_policy = "never"
default_permissions = "byoa-runtime"
cli_auth_credentials_store = "file"

[permissions.byoa-runtime.filesystem]
":minimal" = "read"
"/workspace" = "${access}"
"/var/lib/byoa/codex" = "deny"

[permissions.byoa-runtime.network]
enabled = false
`;
}
