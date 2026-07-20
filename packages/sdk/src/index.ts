export type DeviceLogin = {
  type: "chatgptDeviceCode";
  loginId: string;
  verificationUrl: string;
  userCode: string;
};

export type BYOAEvent = {
  method: string;
  params?: unknown;
};

export type BYOAOptions = {
  endpoint: string;
  token: string;
  clientName?: string;
  clientTitle?: string;
  clientVersion?: string;
};

type RpcResponse = {
  id?: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  method?: string;
  params?: unknown;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

export class BYOA extends EventTarget {
  readonly endpoint: string;
  readonly token: string;
  readonly clientName: string;
  readonly clientTitle: string;
  readonly clientVersion: string;

  #socket?: WebSocket;
  #nextId = 1;
  #pending = new Map<number, PendingRequest>();

  constructor(options: BYOAOptions) {
    super();
    this.endpoint = options.endpoint.replace(/\/$/, "");
    this.token = options.token;
    this.clientName = options.clientName ?? "byoa-sdk";
    this.clientTitle = options.clientTitle ?? "BYOA SDK";
    this.clientVersion = options.clientVersion ?? "0.0.1";
  }

  async connect(): Promise<void> {
    if (this.#socket?.readyState === WebSocket.OPEN) return;

    const url = new URL(this.endpoint);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `${url.pathname.replace(/\/$/, "")}/v1/connect`;
    url.searchParams.set("token", this.token);

    const socket = new WebSocket(url);
    this.#socket = socket;

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("could not connect to the BYOA runner"));
      };
      const cleanup = () => {
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
      };
      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
    });

    socket.addEventListener("message", (event) => this.#onMessage(String(event.data)));
    socket.addEventListener("close", () => this.#onClose());

    await this.request("initialize", {
      clientInfo: { name: this.clientName, title: this.clientTitle, version: this.clientVersion },
      capabilities: {},
    });
    this.notify("initialized");
  }

  close(): void {
    this.#socket?.close(1000, "client closed");
  }

  async readAccount(): Promise<unknown> {
    return this.request("account/read", { refreshToken: false });
  }

  async startDeviceLogin(): Promise<DeviceLogin> {
    return this.request<DeviceLogin>("account/login/start", { type: "chatgptDeviceCode" });
  }

  async startThread(options: Record<string, unknown> = {}): Promise<unknown> {
    return this.request("thread/start", options);
  }

  async startTurn(threadId: string, input: string): Promise<unknown> {
    return this.request("turn/start", {
      threadId,
      input: [{ type: "text", text: input }],
    });
  }

  request<T = unknown>(method: string, params: unknown = {}): Promise<T> {
    if (this.#socket?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("BYOA is not connected"));
    }

    const id = this.#nextId++;
    const promise = new Promise<T>((resolve, reject) => {
      this.#pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
    });
    this.#socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  notify(method: string, params: unknown = {}): void {
    if (this.#socket?.readyState !== WebSocket.OPEN) {
      throw new Error("BYOA is not connected");
    }
    this.#socket.send(JSON.stringify({ method, params }));
  }

  #onMessage(raw: string): void {
    let message: RpcResponse;
    try {
      message = JSON.parse(raw) as RpcResponse;
    } catch {
      this.dispatchEvent(new CustomEvent("protocol-error", { detail: raw }));
      return;
    }

    if (typeof message.id === "number") {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
      return;
    }

    if (message.method) {
      this.dispatchEvent(new CustomEvent<BYOAEvent>("event", {
        detail: { method: message.method, params: message.params },
      }));
      this.dispatchEvent(new CustomEvent(message.method, { detail: message.params }));
    }
  }

  #onClose(): void {
    for (const pending of this.#pending.values()) {
      pending.reject(new Error("BYOA connection closed"));
    }
    this.#pending.clear();
    this.dispatchEvent(new Event("close"));
  }
}
