interface Env {
  BYOA_URL?: string;
  BYOA_APP_SECRET?: string;
  DEMO_COOKIE_SECRET?: string;
  TURNSTILE_VERIFY_URL?: string;
}

type SessionRequest = { turnstileToken?: string };
type TurnstileResult = { success?: boolean; action?: string; hostname?: string; "error-codes"?: string[] };

const cookieName = "__Host-byoa_demo";
const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sign(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

async function verify(secret: string, value: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    return crypto.subtle.verify("HMAC", key, decodeBase64url(signature), encoder.encode(value));
  } catch {
    return false;
  }
}

async function identityFrom(request: Request, secret: string): Promise<{ id: string; fresh: boolean }> {
  const cookie = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);

  if (cookie) {
    const [id, signature] = cookie.split(".");
    if (id && signature && await verify(secret, id, signature)) return { id, fresh: false };
  }

  return { id: crypto.randomUUID(), fresh: true };
}

function json(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(value), { ...init, headers });
}

async function verifyTurnstile(request: Request, verifyUrl: string): Promise<boolean> {
  let input: SessionRequest;
  try {
    input = await request.json<SessionRequest>();
  } catch {
    return false;
  }

  if (typeof input.turnstileToken !== "string" || !input.turnstileToken || input.turnstileToken.length > 2048) return false;
  const response = await fetch(verifyUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: input.turnstileToken,
      remoteip: request.headers.get("CF-Connecting-IP") ?? undefined,
      idempotency_key: crypto.randomUUID(),
    }),
  });
  if (!response.ok) return false;
  const result = await response.json<TurnstileResult>();
  return result.success === true && result.action === "turnstile-spin-v1";
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.BYOA_URL || !env.BYOA_APP_SECRET || !env.DEMO_COOKIE_SECRET || !env.TURNSTILE_VERIFY_URL) {
    return json({ error: "The demo runner is not online yet." }, { status: 503 });
  }

  if (!await verifyTurnstile(request, env.TURNSTILE_VERIFY_URL)) {
    return json({ error: "Please complete the security check and try again." }, { status: 403 });
  }

  const identity = await identityFrom(request, env.DEMO_COOKIE_SECRET);
  const response = await fetch(`${env.BYOA_URL.replace(/\/$/, "")}/v1/sessions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.BYOA_APP_SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      installationId: "byoa-demo",
      userId: identity.id,
      workspaceId: "chat",
      workspaceAccess: "read-only",
      ttlSeconds: 300,
    }),
  });

  if (!response.ok) {
    const status = response.status === 429 ? 429 : 502;
    const headers = new Headers();
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) headers.set("retry-after", retryAfter);
    return json(
      { error: status === 429 ? "Too many sessions. Try again in a minute." : "The demo runner did not create a session." },
      { status, headers },
    );
  }
  const session = await response.json();
  const headers = new Headers();
  if (identity.fresh) {
    const signature = await sign(env.DEMO_COOKIE_SECRET, identity.id);
    headers.set("set-cookie", `${cookieName}=${identity.id}.${signature}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  }
  return json(session, { headers });
};
