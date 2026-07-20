import { StrictMode, useEffect, useRef, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { BYOA, type DeviceLogin } from "byoa";
import "./styles.css";

type Session = { endpoint: string; token: string };
type Message = { id: string; role: "user" | "agent"; text: string };
type ThreadStart = { thread: { id: string } };
type Delta = { delta?: string };
type LoginResult = { success?: boolean; error?: string | null };

function Demo() {
  const [phase, setPhase] = useState<"idle" | "connecting" | "login" | "ready" | "offline">("idle");
  const [login, setLogin] = useState<DeviceLogin>();
  const [messages, setMessages] = useState<Message[]>([
    { id: "hello", role: "agent", text: "Connect your ChatGPT account, then send a message to a fresh read-only Codex thread." },
  ]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const clientRef = useRef<BYOA | undefined>(undefined);
  const threadRef = useRef<string | undefined>(undefined);
  const responseRef = useRef<string | undefined>(undefined);

  useEffect(() => () => clientRef.current?.close(), []);

  const connect = async () => {
    setPhase("connecting");
    setError(undefined);
    try {
      const response = await fetch("/api/session", { method: "POST" });
      const payload = await response.json() as Session & { error?: string };
      if (!response.ok) {
        setPhase("offline");
        setError(payload.error ?? "The demo runner is unavailable.");
        return;
      }

      const client = new BYOA({ ...payload, clientName: "byoa_demo", clientTitle: "BYOA Demo" });
      clientRef.current = client;
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
      await client.connect();

      const account = await client.readAccount() as { account?: unknown };
      if (account.account) {
        setPhase("ready");
        return;
      }

      const deviceLogin = await client.startDeviceLogin();
      setLogin(deviceLogin);
      setPhase("login");
      client.addEventListener("account/login/completed", (event) => {
        const result = (event as CustomEvent<LoginResult>).detail;
        if (result.success === false) {
          setError(result.error ?? "ChatGPT sign-in failed.");
          setPhase("idle");
          return;
        }
        setPhase("ready");
      }, { once: true });
    } catch (cause) {
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
    setError(undefined);
    const userId = crypto.randomUUID();
    const responseId = crypto.randomUUID();
    responseRef.current = responseId;
    setMessages((current) => [...current, { id: userId, role: "user", text }, { id: responseId, role: "agent", text: "" }]);

    try {
      if (!threadRef.current) {
        const started = await client.startThread({ ephemeral: true, sandbox: "read-only", approvalPolicy: "never" }) as ThreadStart;
        threadRef.current = started.thread.id;
      }
      await client.startTurn(threadRef.current, text);
    } catch (cause) {
      setRunning(false);
      responseRef.current = undefined;
      setError(cause instanceof Error ? cause.message : "The turn failed.");
    }
  };

  return (
    <main>
      <header><a href="https://byoa-3ln.pages.dev">byoa</a><span>/ demo</span><a href="https://github.com/rishabhsai/byoa">source</a></header>

      <section className="demo-shell">
        <div className="demo-head">
          <div><p>example app</p><h1>chat with your agent</h1></div>
          <span className={`runtime runtime-${phase}`}>{phase === "ready" ? "agent connected" : phase === "offline" ? "runner offline" : "read-only sandbox"}</span>
        </div>

        {phase === "idle" || phase === "connecting" || phase === "offline" ? (
          <div className="connect-panel">
            <p>This is the smallest BYOA integration: one anonymous app session, one isolated runner, and one user-authorized Codex account.</p>
            <button type="button" onClick={connect} disabled={phase === "connecting"}>{phase === "connecting" ? "starting runner…" : "connect chatgpt"}</button>
            {error ? <p className="error">{error} The interface is live; the container backend is still being brought online.</p> : null}
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
            <div className="messages" aria-live="polite">
              {messages.map((message) => <div className={`message ${message.role}`} key={message.id}><b>{message.role === "agent" ? "agent" : "you"}</b><p>{message.text || "▌"}</p></div>)}
            </div>
            <form onSubmit={send}>
              <label htmlFor="message">message</label>
              <textarea id="message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="ask the agent something" rows={3} />
              <button type="submit" disabled={running || !draft.trim()}>{running ? "running…" : "send"}</button>
            </form>
            {error ? <p className="error">{error}</p> : null}
          </div>
        ) : null}
      </section>

      <footer><span>no shared api key</span><span>ephemeral thread / read-only sandbox</span></footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Demo /></StrictMode>);
