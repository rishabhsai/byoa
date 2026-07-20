import { getSandbox } from "@cloudflare/sandbox";
export { Sandbox } from "@cloudflare/sandbox";

type RunnerEnv = Env & {
  BYOA_APP_SECRET: string;
  BYOA_DISABLED?: string;
};

type SessionClaims = {
  sandboxId: string;
  exp: number;
};

type SessionInput = {
  installationId: string;
  userId: string;
  workspaceId: string;
  ttlSeconds?: number;
};

const encoder = new TextEncoder();

function json(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(value), { ...init, headers });
}

function event(name: string, fields: Record<string, string | number> = {}): void {
  console.log(JSON.stringify({ event: name, ...fields }));
}

function unavailable(): Response {
  return json({ error: "runner temporarily disabled" }, { status: 503, headers: { "retry-after": "60" } });
}

function limited(route: string): Response {
  event("rate_limited", { route });
  return json({ error: "rate limit exceeded" }, { status: 429, headers: { "retry-after": "60" } });
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64url(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function secureEqual(left: Uint8Array, right: Uint8Array): Promise<boolean> {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++) mismatch |= left[index]! ^ right[index]!;
  return mismatch === 0;
}

async function secureStringEqual(left: string, right: string): Promise<boolean> {
  return secureEqual(encoder.encode(left), encoder.encode(right));
}

async function sandboxIdFor(input: SessionInput): Promise<string> {
  const source = `${input.installationId}\0${input.userId}\0${input.workspaceId}`;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(source)));
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `byoa-${hex.slice(0, 40)}`;
}

async function sessionRateKey(input: SessionInput): Promise<string> {
  const source = `${input.installationId}\0${input.userId}`;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(source)));
  return base64url(digest);
}

async function issueToken(secret: string, claims: SessionClaims): Promise<string> {
  const payload = base64url(encoder.encode(JSON.stringify(claims)));
  const signature = base64url(await hmac(secret, payload));
  return `${payload}.${signature}`;
}

async function verifyToken(secret: string, token: string): Promise<SessionClaims | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    if (!payload || !signature) return null;
    const expected = await hmac(secret, payload);
    if (!await secureEqual(expected, decodeBase64url(signature))) return null;
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64url(payload))) as SessionClaims;
    if (!claims.sandboxId || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

function bearer(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

async function createSession(request: Request, env: RunnerEnv): Promise<Response> {
  const authorization = bearer(request);
  if (!env.BYOA_APP_SECRET || !authorization || !await secureStringEqual(authorization, env.BYOA_APP_SECRET)) {
    return json({ error: "unauthorized" }, { status: 401 });
  }

  let input: SessionInput;
  try {
    input = await request.json<SessionInput>();
  } catch {
    return json({ error: "invalid json" }, { status: 400 });
  }

  if (![input.installationId, input.userId, input.workspaceId].every((value) => typeof value === "string" && value.length > 0 && value.length <= 200)) {
    return json({ error: "installationId, userId, and workspaceId are required" }, { status: 400 });
  }

  const rate = await env.SESSION_RATE_LIMITER.limit({ key: await sessionRateKey(input) });
  if (!rate.success) return limited("sessions");

  const ttl = Math.min(Math.max(input.ttlSeconds ?? 300, 60), 900);
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const sandboxId = await sandboxIdFor(input);
  const token = await issueToken(env.BYOA_APP_SECRET, {
    sandboxId,
    exp: expiresAt,
  });

  event("session_created", { sandbox: sandboxId.slice(-12), ttl });

  return json({ token, expiresAt, endpoint: new URL(request.url).origin });
}

async function connect(request: Request, env: RunnerEnv): Promise<Response> {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return json({ error: "websocket required" }, { status: 426 });
  }

  const token = new URL(request.url).searchParams.get("token");
  const claims = token ? await verifyToken(env.BYOA_APP_SECRET, token) : null;
  if (!claims) return json({ error: "invalid or expired session" }, { status: 401 });

  const rate = await env.CONNECT_RATE_LIMITER.limit({ key: claims.sandboxId });
  if (!rate.success) return limited("connect");

  const sandbox = getSandbox(env.Sandbox, claims.sandboxId, { sleepAfter: "10m" });
  const processes = await sandbox.listProcesses();
  let supervisor = processes.find((process) => process.id === "byoa-supervisor");
  if (!supervisor) {
    supervisor = await sandbox.startProcess("node /opt/byoa/supervisor.mjs", {
      processId: "byoa-supervisor",
      env: {
        CODEX_HOME: "/var/lib/byoa/codex",
        BYOA_SUPERVISOR_PORT: "8787",
      },
      autoCleanup: true,
    });
    event("supervisor_started", { sandbox: claims.sandboxId.slice(-12) });
  }

  try {
    await supervisor.waitForPort(8787, { path: "/health", timeout: 20_000 });
  } catch (error) {
    console.error(JSON.stringify({
      event: "supervisor_failed",
      sandbox: claims.sandboxId.slice(-12),
      error: error instanceof Error ? error.message : String(error),
    }));
    throw error;
  }

  return sandbox.wsConnect(request, 8787);
}

export default {
  async fetch(request: Request, env: RunnerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/v1/health") {
      return json({ ok: true, service: "byoa-runner", acceptingSessions: env.BYOA_DISABLED !== "1" });
    }
    if (env.BYOA_DISABLED === "1") return unavailable();
    if (request.method === "POST" && url.pathname === "/v1/sessions") {
      return createSession(request, env);
    }
    if (request.method === "GET" && url.pathname === "/v1/connect") {
      return connect(request, env);
    }
    return json({ error: "not found" }, { status: 404 });
  },
} satisfies ExportedHandler<RunnerEnv>;
