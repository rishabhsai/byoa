export type BYOAJson = null | boolean | number | string | BYOAJson[] | { [key: string]: BYOAJson };

export type DeviceLogin = {
  type: "chatgptDeviceCode";
  loginId: string;
  verificationUrl: string;
  userCode: string;
};

export type BYOAEvent<T = unknown> = {
  method: string;
  params?: T;
};

export type BYOAServerRequest<T = unknown> = BYOAEvent<T> & {
  id: number;
};

export type BYOAReasoningEffort = {
  reasoningEffort: string;
  description: string;
};

export type BYOAModel = {
  id: string;
  model: string;
  displayName: string;
  description: string;
  hidden: boolean;
  supportedReasoningEfforts: BYOAReasoningEffort[];
  defaultReasoningEffort: string;
  inputModalities: string[];
  supportsPersonality: boolean;
  serviceTiers: Array<{ id: string; name: string; description: string }>;
  isDefault: boolean;
};

export type BYOAModelList = {
  data: BYOAModel[];
  nextCursor: string | null;
};

export type BYOAProviderCapabilities = {
  namespaceTools: boolean;
  imageGeneration: boolean;
  webSearch: boolean;
};

export type BYOAUserInput =
  | { type: "text"; text: string; text_elements?: Array<{ start: number; end: number; placeholder?: string }> }
  | { type: "image"; url: string }
  | { type: "localImage"; path: string }
  | { type: "audio"; url: string }
  | { type: "localAudio"; path: string }
  | { type: "skill"; name: string; path: string }
  | { type: "mention"; name: string; path: string };

export type BYOADynamicFunctionTool = {
  type: "function";
  name: string;
  description: string;
  inputSchema: BYOAJson;
  deferLoading?: boolean;
};

export type BYOADynamicTool = BYOADynamicFunctionTool | {
  type: "namespace";
  name: string;
  description: string;
  tools: BYOADynamicFunctionTool[];
};

export type BYOAThreadOptions = {
  model?: string;
  modelProvider?: string;
  serviceTier?: string;
  cwd?: string;
  approvalPolicy?: "untrusted" | "on-failure" | "on-request" | "never" | string;
  approvalsReviewer?: "user" | "auto_review" | string;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access" | string;
  config?: Record<string, BYOAJson>;
  serviceName?: string;
  baseInstructions?: string;
  developerInstructions?: string;
  personality?: string;
  ephemeral?: boolean;
  dynamicTools?: BYOADynamicTool[];
};

export type BYOAThread = {
  id: string;
  [key: string]: unknown;
};

export type BYOAThreadStart = {
  thread: BYOAThread;
  model: string;
  modelProvider: string;
  cwd: string;
  instructionSources: string[];
  [key: string]: unknown;
};

export type BYOATurnOptions = {
  cwd?: string;
  approvalPolicy?: string;
  approvalsReviewer?: string;
  sandboxPolicy?: BYOAJson;
  model?: string;
  serviceTier?: string;
  effort?: string;
  summary?: string;
  personality?: string;
  outputSchema?: BYOAJson;
};

export type BYOATurnStart = {
  turn: { id: string; status: string; [key: string]: unknown };
};

export type BYOADynamicToolCall = {
  threadId: string;
  turnId: string;
  callId: string;
  namespace: string | null;
  tool: string;
  arguments: BYOAJson;
};

export type BYOAToolResult = {
  contentItems: Array<
    | { type: "inputText"; text: string }
    | { type: "inputImage"; imageUrl: string }
  >;
  success: boolean;
};

export type BYOAThreadItem = {
  type: string;
  id: string;
  [key: string]: unknown;
};

export type BYOAItemNotification = {
  item: BYOAThreadItem;
  threadId: string;
  turnId: string;
};

export type BYOAOptions = {
  endpoint: string;
  token: string;
  clientName?: string;
  clientTitle?: string;
  clientVersion?: string;
  experimentalApi?: boolean;
  connectTimeoutMs?: number;
  requestTimeoutMs?: number;
};

type RpcMessage = {
  id?: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  method?: string;
  params?: unknown;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type DynamicToolHandler = (call: BYOADynamicToolCall) => BYOAToolResult | Promise<BYOAToolResult>;

function normalizeInput(input: string | BYOAUserInput[]): BYOAUserInput[] {
  return typeof input === "string" ? [{ type: "text", text: input }] : input;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export class BYOA extends EventTarget {
  readonly endpoint: string;
  readonly token: string;
  readonly clientName: string;
  readonly clientTitle: string;
  readonly clientVersion: string;
  readonly experimentalApi: boolean;
  readonly connectTimeoutMs: number;
  readonly requestTimeoutMs: number;

  #socket?: WebSocket;
  #nextId = 1;
  #pending = new Map<number, PendingRequest>();

  readonly threads = {
    start: (options: BYOAThreadOptions = {}) => this.request<BYOAThreadStart>("thread/start", options),
    resume: (threadId: string, options: Omit<BYOAThreadOptions, "ephemeral" | "dynamicTools"> = {}) =>
      this.request<BYOAThreadStart>("thread/resume", { threadId, ...options }),
    fork: (threadId: string, options: BYOAThreadOptions = {}) =>
      this.request<BYOAThreadStart>("thread/fork", { threadId, ...options }),
    read: (threadId: string, includeTurns = true) =>
      this.request<{ thread: BYOAThread }>("thread/read", { threadId, includeTurns }),
    list: (options: Record<string, unknown> = {}) => this.request("thread/list", options),
    archive: (threadId: string) => this.request("thread/archive", { threadId }),
  };

  readonly turns = {
    start: (threadId: string, input: string | BYOAUserInput[], options: BYOATurnOptions = {}) =>
      this.request<BYOATurnStart>("turn/start", { threadId, input: normalizeInput(input), ...options }),
    steer: (threadId: string, turnId: string, input: string | BYOAUserInput[]) =>
      this.request("turn/steer", { threadId, expectedTurnId: turnId, input: normalizeInput(input) }),
    interrupt: (threadId: string, turnId: string) => this.request("turn/interrupt", { threadId, turnId }),
  };

  readonly workspace = {
    read: async (path: string): Promise<Uint8Array> => {
      const result = await this.request<{ dataBase64: string }>("fs/readFile", { path });
      return base64ToBytes(result.dataBase64);
    },
    readText: async (path: string): Promise<string> =>
      new TextDecoder().decode(await this.workspace.read(path)),
    write: async (path: string, data: string | Uint8Array | ArrayBuffer | Blob): Promise<void> => {
      let bytes: Uint8Array;
      if (typeof data === "string") bytes = new TextEncoder().encode(data);
      else if (data instanceof Blob) bytes = new Uint8Array(await data.arrayBuffer());
      else if (data instanceof Uint8Array) bytes = data;
      else bytes = new Uint8Array(data);
      await this.request("fs/writeFile", { path, dataBase64: bytesToBase64(bytes) });
    },
    mkdir: (path: string, recursive = true) => this.request("fs/createDirectory", { path, recursive }),
    list: (path: string) => this.request("fs/readDirectory", { path }),
    metadata: (path: string) => this.request("fs/getMetadata", { path }),
    remove: (path: string, options: { recursive?: boolean; force?: boolean } = {}) =>
      this.request("fs/remove", { path, ...options }),
    watch: (watchId: string, path: string) => this.request("fs/watch", { watchId, path }),
    unwatch: (watchId: string) => this.request("fs/unwatch", { watchId }),
  };

  readonly models = {
    list: (options: { cursor?: string; limit?: number; includeHidden?: boolean } = {}) =>
      this.request<BYOAModelList>("model/list", options),
    capabilities: () => this.request<BYOAProviderCapabilities>("modelProvider/capabilities/read"),
  };

  readonly mcp = {
    status: (options: Record<string, unknown> = {}) => this.request("mcpServerStatus/list", options),
    readResource: (server: string, uri: string, threadId?: string) =>
      this.request("mcpServer/resource/read", { server, uri, ...(threadId ? { threadId } : {}) }),
    call: (threadId: string, server: string, tool: string, args: BYOAJson = {}) =>
      this.request("mcpServer/tool/call", { threadId, server, tool, arguments: args }),
  };

  readonly extensions = {
    skills: (cwd: string[]) => this.request("skills/list", { cwds: cwd }),
    hooks: (cwd: string[]) => this.request("hooks/list", { cwds: cwd }),
  };

  constructor(options: BYOAOptions) {
    super();
    this.endpoint = options.endpoint.replace(/\/$/, "");
    this.token = options.token;
    this.clientName = options.clientName ?? "byoa-sdk";
    this.clientTitle = options.clientTitle ?? "BYOA SDK";
    this.clientVersion = options.clientVersion ?? "0.2.0";
    this.experimentalApi = options.experimentalApi ?? false;
    this.connectTimeoutMs = Math.max(1, options.connectTimeoutMs ?? 60_000);
    this.requestTimeoutMs = Math.max(1, options.requestTimeoutMs ?? 60_000);
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
      const timeout = setTimeout(() => {
        cleanup();
        try { socket.close(); } catch { /* connection is still opening */ }
        reject(new Error("BYOA runner connection timed out"));
      }, this.connectTimeoutMs);
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("could not connect to the BYOA runner"));
      };
      const onClose = () => {
        cleanup();
        reject(new Error("BYOA runner closed before connecting"));
      };
      const cleanup = () => {
        clearTimeout(timeout);
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
      };
      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
      socket.addEventListener("close", onClose);
    });

    socket.addEventListener("message", (event) => this.#onMessage(String(event.data)));
    socket.addEventListener("close", () => this.#onClose());

    await this.request("initialize", {
      clientInfo: { name: this.clientName, title: this.clientTitle, version: this.clientVersion },
      capabilities: { experimentalApi: this.experimentalApi },
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

  async logout(): Promise<void> {
    await this.request("account/logout");
  }

  async startThread(options: BYOAThreadOptions = {}): Promise<BYOAThreadStart> {
    return this.threads.start(options);
  }

  async listModels(options: { cursor?: string; limit?: number; includeHidden?: boolean } = {}): Promise<BYOAModelList> {
    return this.models.list(options);
  }

  async startTurn(threadId: string, input: string | BYOAUserInput[], options: BYOATurnOptions = {}): Promise<BYOATurnStart> {
    return this.turns.start(threadId, input, options);
  }

  onToolCall(handler: DynamicToolHandler): () => void {
    const listener = (event: Event) => {
      const request = (event as CustomEvent<BYOAServerRequest<BYOADynamicToolCall>>).detail;
      if (request.method !== "item/tool/call") return;
      void Promise.resolve(handler(request.params!))
        .then((result) => this.respond(request.id, result))
        .catch((cause) => this.respond(request.id, {
          contentItems: [{ type: "inputText", text: cause instanceof Error ? cause.message : "tool failed" }],
          success: false,
        } satisfies BYOAToolResult));
    };
    this.addEventListener("request", listener);
    return () => this.removeEventListener("request", listener);
  }

  request<T = unknown>(method: string, params: unknown = {}, timeoutMs = this.requestTimeoutMs): Promise<T> {
    if (this.#socket?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("BYOA is not connected"));
    }

    const id = this.#nextId++;
    const promise = new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, Math.max(1, timeoutMs));
      this.#pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
      });
    });
    this.#socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  notify(method: string, params: unknown = {}): void {
    this.#send({ method, params });
  }

  respond(id: number, result: unknown): void {
    this.#send({ id, result });
  }

  respondError(id: number, code: number, message: string, data?: unknown): void {
    this.#send({ id, error: { code, message, ...(data === undefined ? {} : { data }) } });
  }

  #send(message: RpcMessage): void {
    if (this.#socket?.readyState !== WebSocket.OPEN) throw new Error("BYOA is not connected");
    this.#socket.send(JSON.stringify(message));
  }

  #onMessage(raw: string): void {
    let message: RpcMessage;
    try {
      message = JSON.parse(raw) as RpcMessage;
    } catch {
      this.dispatchEvent(new CustomEvent("protocol-error", { detail: raw }));
      return;
    }

    if (typeof message.id === "number" && message.method) {
      const detail: BYOAServerRequest = { id: message.id, method: message.method, params: message.params };
      this.dispatchEvent(new CustomEvent("request", { detail }));
      this.dispatchEvent(new CustomEvent(`request:${message.method}`, { detail }));
      return;
    }

    if (typeof message.id === "number") {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      clearTimeout(pending.timeout);
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
      clearTimeout(pending.timeout);
      pending.reject(new Error("BYOA connection closed"));
    }
    this.#pending.clear();
    this.dispatchEvent(new Event("close"));
  }
}
