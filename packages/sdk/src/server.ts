export type SessionRequest = {
  installationId: string;
  userId: string;
  workspaceId: string;
  workspaceAccess?: "read-only" | "workspace-write";
  ttlSeconds?: number;
};

export type SessionResponse = {
  token: string;
  expiresAt: number;
  endpoint: string;
};

export class BYOAServer {
  readonly endpoint: string;
  readonly secret: string;

  constructor(options: { endpoint: string; secret: string }) {
    this.endpoint = options.endpoint.replace(/\/$/, "");
    this.secret = options.secret;
  }

  async createSession(request: SessionRequest): Promise<SessionResponse> {
    const response = await fetch(`${this.endpoint}/v1/sessions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`BYOA session failed (${response.status}): ${detail}`);
    }

    return response.json() as Promise<SessionResponse>;
  }
}
