import { StrictMode, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createRoot } from "react-dom/client";
import { BYOA, type BYOAItemNotification, type BYOAModel, type DeviceLogin } from "@rishabhsai/byoa";
import "./styles.css";

type Session = { endpoint: string; token: string };
type Mode = "chat" | "image";
type Message = { id: string; role: "user" | "agent"; text: string; image?: { src: string; prompt?: string } };
type ThreadStart = { thread: { id: string } };
type Delta = { delta?: string };
type LoginResult = { success?: boolean; error?: string | null };

type TurnstileApi = {
  render(container: HTMLElement, options: {
    sitekey: string;
    action: string;
    theme: "dark";
    size: "flexible";
    callback(token: string): void;
    "expired-callback"(): void;
    "error-callback"(): void;
  }): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const initialMessages: Message[] = [
  { id: "hello", role: "agent", text: "Connect ChatGPT, then try a text or image task on your own Codex account." },
];

function TurnstileGate({ onToken, resetKey }: { onToken(token: string | undefined): void; resetKey: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!turnstileSiteKey || !containerRef.current) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetRef.current) return;
      widgetRef.current = window.turnstile.render(containerRef.current, {
        sitekey: turnstileSiteKey,
        action: "turnstile-spin-v1",
        theme: "dark",
        size: "flexible",
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(undefined),
        "error-callback": () => onToken(undefined),
      });
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-byoa-turnstile]');
    if (existing) {
      if (window.turnstile) render();
      else existing.addEventListener("load", render, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.byoaTurnstile = "";
      script.addEventListener("load", render, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current);
      widgetRef.current = undefined;
    };
  }, [onToken]);

  useEffect(() => {
    if (widgetRef.current && window.turnstile) window.turnstile.reset(widgetRef.current);
  }, [resetKey]);

  if (!turnstileSiteKey) return <p className="error">security check is not configured.</p>;
  return <div className="turnstile-slot" ref={containerRef} data-action="turnstile-spin-v1" />;
}

function imageSource(result: string): string {
  if (result.startsWith("data:") || result.startsWith("blob:") || result.startsWith("https://")) return result;
  return `data:image/png;base64,${result}`;
}

function Demo() {
  const [phase, setPhase] = useState<"idle" | "connecting" | "login" | "ready" | "offline">("idle");
  const [login, setLogin] = useState<DeviceLogin>();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [mode, setMode] = useState<Mode>("chat");
  const [imageGeneration, setImageGeneration] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [models, setModels] = useState<BYOAModel[]>([]);
  const [model, setModel] = useState("");
  const [effort, setEffort] = useState("");
  const clientRef = useRef<BYOA | undefined>(undefined);
  const threadRef = useRef<string | undefined>(undefined);
  const responseRef = useRef<string | undefined>(undefined);
  const messagesRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [followingMessages, setFollowingMessages] = useState(true);

  useEffect(() => () => {
    const client = clientRef.current;
    clientRef.current = undefined;
    client?.close();
  }, []);

  useLayoutEffect(() => {
    if (!followingMessages) return;
    const messagesElement = messagesRef.current;
    if (messagesElement) messagesElement.scrollTop = messagesElement.scrollHeight;
  }, [messages, followingMessages]);

  useLayoutEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = "auto";
    composer.style.height = `${Math.min(composer.scrollHeight, 160)}px`;
  }, [draft]);

  useEffect(() => {
    if (phase !== "ready" || running || loggingOut) return;
    const frame = requestAnimationFrame(() => composerRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [phase, running, loggingOut]);

  const loadModels = async (client: BYOA) => {
    try {
      const response = await client.listModels({ limit: 100, includeHidden: false });
      const available = response.data.filter((item) => !item.hidden);
      const preferred = available.find((item) => item.isDefault) ?? available[0];
      setModels(available);
      setModel(preferred?.model ?? "");
      setEffort(preferred?.defaultReasoningEffort ?? "");
      const capabilities = await client.models.capabilities();
      setImageGeneration(capabilities.imageGeneration);
    } catch {
      setModels([]);
      setImageGeneration(false);
    }
  };

  const ready = (client: BYOA) => {
    setError(undefined);
    setPhase("ready");
    setFollowingMessages(true);
    void loadModels(client);
  };

  const connect = async () => {
    if (!turnstileToken) return;
    setPhase("connecting");
    setError(undefined);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ turnstileToken }),
      });
      setTurnstileToken(undefined);
      setTurnstileReset((value) => value + 1);
      const payload = await response.json() as Session & { error?: string };
      if (!response.ok) {
        setPhase("offline");
        setError(payload.error ?? "The demo runner is unavailable.");
        return;
      }

      const client = new BYOA({ ...payload, clientName: "byoa_demo", clientTitle: "BYOA Demo" });
      clientRef.current = client;
      client.addEventListener("close", () => {
        if (clientRef.current !== client) return;
        clientRef.current = undefined;
        threadRef.current = undefined;
        responseRef.current = undefined;
        setRunning(false);
        setPhase("offline");
        setError("runner connection closed. reconnect to continue.");
      });
      client.addEventListener("item/agentMessage/delta", (event) => {
        const delta = (event as CustomEvent<Delta>).detail.delta;
        const responseId = responseRef.current;
        if (!delta || !responseId) return;
        setMessages((current) => current.map((message) => message.id === responseId ? { ...message, text: message.text + delta } : message));
      });
      client.addEventListener("turn/completed", () => {
        setRunning(false);
        responseRef.current = undefined;
      });
      client.addEventListener("item/completed", (event) => {
        const { item } = (event as CustomEvent<BYOAItemNotification>).detail;
        const responseId = responseRef.current;
        if (!responseId || item.type !== "imageGeneration" || typeof item.result !== "string" || !item.result) return;
        setMessages((current) => current.map((message) => message.id === responseId ? {
          ...message,
          image: {
            src: imageSource(item.result as string),
            ...(typeof item.revisedPrompt === "string" ? { prompt: item.revisedPrompt } : {}),
          },
        } : message));
      });
      await client.connect();

      const account = await client.readAccount() as { account?: unknown };
      if (account.account) {
        ready(client);
        return;
      }

      const deviceLogin = await client.startDeviceLogin();
      setLogin(deviceLogin);
      setPhase("login");
      client.addEventListener("account/login/completed", (event) => {
        const result = (event as CustomEvent<LoginResult>).detail;
        if (result.success === false) {
          clientRef.current = undefined;
          client.close();
          setError(result.error ?? "ChatGPT sign-in failed.");
          setPhase("idle");
          return;
        }
        ready(client);
      }, { once: true });
    } catch (cause) {
      const client = clientRef.current;
      clientRef.current = undefined;
      client?.close();
      setTurnstileToken(undefined);
      setTurnstileReset((value) => value + 1);
      setPhase("offline");
      setError(cause instanceof Error ? cause.message : "The demo could not connect.");
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    const client = clientRef.current;
    if (!text || !client || running) return;

    setDraft("");
    setRunning(true);
    setFollowingMessages(true);
    setError(undefined);
    const userId = crypto.randomUUID();
    const responseId = crypto.randomUUID();
    responseRef.current = responseId;
    setMessages((current) => [...current, { id: userId, role: "user", text }, { id: responseId, role: "agent", text: "" }]);

    try {
      if (!threadRef.current) {
        const started = await client.startThread({
          ephemeral: true,
          ...(model ? { model } : {}),
        }) as ThreadStart;
        threadRef.current = started.thread.id;
      }
      const input = mode === "image"
        ? `Generate an image from this prompt. Use the image generation tool.\n\n${text}`
        : text;
      await client.startTurn(threadRef.current, input, {
        ...(model ? { model } : {}),
        ...(effort ? { effort } : {}),
      });
    } catch (cause) {
      setRunning(false);
      responseRef.current = undefined;
      setMessages((current) => current.filter((message) => message.id !== responseId || Boolean(message.text || message.image)));
      setError(cause instanceof Error ? cause.message : "The turn failed.");
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!running) event.currentTarget.form?.requestSubmit();
  };

  const onMessagesScroll = () => {
    const messagesElement = messagesRef.current;
    if (!messagesElement) return;
    const distanceFromBottom = messagesElement.scrollHeight - messagesElement.scrollTop - messagesElement.clientHeight;
    setFollowingMessages(distanceFromBottom < 48);
  };

  const scrollToLatest = () => {
    setFollowingMessages(true);
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight });
  };

  const logout = async () => {
    const client = clientRef.current;
    if (!client || running || loggingOut) return;
    setLoggingOut(true);
    setError(undefined);
    try {
      await client.logout();
      clientRef.current = undefined;
      client.close();
      threadRef.current = undefined;
      responseRef.current = undefined;
      setLogin(undefined);
      setMessages(initialMessages);
      setModels([]);
      setModel("");
      setEffort("");
      setImageGeneration(false);
      setMode("chat");
      setDraft("");
      setFollowingMessages(true);
      setTurnstileToken(undefined);
      setPhase("idle");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ChatGPT logout failed.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <main>
      <header><a href="https://byoa.lol">byoa</a><span>/ demo</span><a href="https://github.com/rishabhsai/byoa">source</a></header>

      <section className="demo-shell">
        <div className="demo-head">
          <div><p>example app</p><h1>try your agent</h1></div>
          <span className={`runtime runtime-${phase}`}>{phase === "ready" ? "agent connected" : phase === "offline" ? "runner offline" : "read-only sandbox"}</span>
        </div>

        {phase === "idle" || phase === "connecting" || phase === "offline" ? (
          <div className="connect-panel">
            <p>This is the smallest BYOA integration: one anonymous app session, one isolated runner, and one user-authorized Codex account.</p>
            <TurnstileGate onToken={setTurnstileToken} resetKey={turnstileReset} />
            <button type="button" onClick={connect} disabled={phase === "connecting" || !turnstileToken}>{phase === "connecting" ? "starting runner…" : "connect chatgpt"}</button>
            {error ? <p className="error" role="alert">{error}</p> : null}
          </div>
        ) : null}

        {phase === "login" && login ? (
          <div className="connect-panel">
            <p>Open ChatGPT, sign in, and enter this one-time code.</p>
            <a className="connect-link" href={login.verificationUrl} target="_blank" rel="noreferrer">open chatgpt ↗</a>
            <code className="device-code">{login.userCode}</code>
            <p className="quiet">This page will continue when Codex confirms the login.</p>
          </div>
        ) : null}

        {phase === "ready" ? (
          <div className="chat">
            <div className="modes" aria-label="demo mode">
              <button className={mode === "chat" ? "active" : ""} type="button" onClick={() => setMode("chat")} disabled={running}>text</button>
              <button className={mode === "image" ? "active" : ""} type="button" onClick={() => setMode("image")} disabled={running || !imageGeneration}>image{imageGeneration ? "" : " / unavailable"}</button>
              <button className="logout" type="button" onClick={logout} disabled={running || loggingOut}>{loggingOut ? "logging out…" : "log out"}</button>
            </div>
            <div className="messages-wrap">
              <div className="messages" ref={messagesRef} role="log" aria-label="conversation" aria-live="polite" aria-relevant="additions text" aria-busy={running} onScroll={onMessagesScroll}>
                {messages.map((message) => (
                  <div className={`message ${message.role}`} key={message.id}>
                    <b>{message.role === "agent" ? "agent" : "you"}</b>
                    <div className="message-body">
                      <p>{message.text || (message.image ? "" : "▌")}</p>
                      {message.image ? <figure><img src={message.image.src} alt={message.image.prompt ?? "generated image"} onLoad={() => { if (followingMessages) scrollToLatest(); }} /><figcaption>{message.image.prompt ?? "generated by codex"}</figcaption></figure> : null}
                    </div>
                  </div>
                ))}
              </div>
              {!followingMessages ? <button className="jump-latest" type="button" onClick={scrollToLatest}>jump to latest ↓</button> : null}
            </div>
            {models.length ? (
              <div className="settings" aria-label="agent settings">
                <label>
                  <span>model</span>
                  <select
                    value={model}
                    disabled={running}
                    onChange={(event) => {
                      const next = models.find((item) => item.model === event.target.value);
                      setModel(event.target.value);
                      setEffort(next?.defaultReasoningEffort ?? "");
                    }}
                  >
                    {models.map((item) => <option key={item.id} value={item.model}>{item.displayName}</option>)}
                  </select>
                </label>
                <label>
                  <span>thinking</span>
                  <select value={effort} disabled={running} onChange={(event) => setEffort(event.target.value)}>
                    {(models.find((item) => item.model === model)?.supportedReasoningEfforts ?? []).map((item) => (
                      <option key={item.reasoningEffort} value={item.reasoningEffort}>{item.reasoningEffort}</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            <form onSubmit={send}>
              <label htmlFor="message">{mode === "image" ? "prompt" : "message"}</label>
              <div className="composer-field">
                <textarea ref={composerRef} id="message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onComposerKeyDown} placeholder={mode === "image" ? "a yellow race car in heavy rain, 35mm film" : "ask the agent something"} rows={1} aria-describedby="message-help" />
                <p id="message-help">enter to send · shift+enter for new line</p>
              </div>
              <button type="submit" disabled={running || !draft.trim()}>{running ? "running…" : mode === "image" ? "generate" : "send"}</button>
            </form>
            {error ? <p className="error" role="alert">{error}</p> : null}
          </div>
        ) : null}
      </section>

      <footer><span>text + image / no shared api key</span><span>ephemeral thread / read-only sandbox</span></footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Demo /></StrictMode>);
