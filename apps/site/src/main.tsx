import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const siteUrl = "https://byoa.lol";
const demoUrl = "https://demo.byoa.lol";
const agentCommand = `curl -fsSL ${siteUrl}/agent`;

function CopyCommand() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(agentCommand);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="command" aria-label="agent setup command">
      <code><span>$</span> {agentCommand}</code>
      <button type="button" onClick={copy}>{copied ? "copied" : "copy"}</button>
    </div>
  );
}

function Header() {
  return (
    <header className="nav">
      <a className="wordmark" href="/">byoa</a>
      <nav aria-label="main navigation">
        <a href="/#how">how it works</a>
        <a href="/#runtime">runtime</a>
        <a href="/#setup">setup</a>
        <a href="/docs">docs</a>
        <a className="nav-demo" href={demoUrl}>demo ↗</a>
        <a href="https://github.com/rishabhsai/byoa">github</a>
      </nav>
    </header>
  );
}

function RuntimeDiagram() {
  return (
    <div className="runtime-diagram" aria-label="BYOA agent runtime inputs and outputs">
      <div className="runtime-side">
        <span>inputs</span>
        <b>text</b><b>images</b><b>files</b><b>audio</b>
      </div>
      <div className="runtime-core">
        <span>your user&apos;s sandbox</span>
        <strong>codex app-server</strong>
        <small>instructions · skills · tools · hooks</small>
      </div>
      <div className="runtime-side">
        <span>outputs</span>
        <b>events</b><b>files</b><b>json</b><b>images</b>
      </div>
    </div>
  );
}

function FlowDiagram() {
  const nodes = [
    ["your app", "asks for a short-lived session"],
    ["byoa worker", "checks the session and picks a runner"],
    ["user sandbox", "keeps one isolated agent home"],
    ["codex app-server", "runs threads and streams events"],
    ["chatgpt account", "the user authorizes their own plan"],
  ];

  return (
    <ol className="flow" aria-label="BYOA request flow">
      {nodes.map(([title, text], index) => (
        <li key={title}>
          <div><strong>{title}</strong><span>{text}</span></div>
          {index < nodes.length - 1 ? <b aria-hidden="true">→</b> : null}
        </li>
      ))}
    </ol>
  );
}

function Landing() {
  return (
    <main className="page">
      <Header />

      <section className="hero" id="top">
        <p className="status">open source / early alpha</p>
        <div className="logo" aria-label="BYOA">BYOA</div>
        <h1>bring your own <a href="#how">agent</a></h1>
        <p className="lead">Run your users&apos; Codex app-server in the cloud. They sign in with ChatGPT. No shared API bill.</p>
        <div className="hero-links"><a href="#setup">set it up</a><span>|</span><a className="demo-link" href={demoUrl}>open the demo ↗</a><span>|</span><a href="https://github.com/rishabhsai/byoa">read the code</a></div>
        <CopyCommand />
      </section>

      <hr />

      <section id="about">
        <h2>what is byoa?</h2>
        <p>BYOA is a small deployment kit for products that need an agent inside the product. The developer deploys one BYOA Worker into their own Cloudflare account. Each user and workspace maps to an isolated runner with its own Codex state.</p>
        <p>The browser never receives your Cloudflare credential or the runner secret. It gets a short-lived BYOA session token. The end user completes Codex&apos;s ChatGPT device login and requests run against the access available to that account.</p>
        <p>It is not a generic replacement for the OpenAI API. It is an integration layer around the open-source Codex app-server for products that need threads, approvals, tools, and streamed agent events.</p>
      </section>

      <hr />

      <section id="how">
        <h2>how it works</h2>
        <FlowDiagram />
        <div className="split-copy">
          <p><strong>the developer owns the runner.</strong><br />Cloudflare runs the Worker and isolated sandboxes. Your backend controls which signed-in app user may create a session.</p>
          <p><strong>the user owns the agent account.</strong><br />Codex handles ChatGPT authorization inside that user&apos;s sandbox. BYOA forwards protocol messages; it does not turn an API key into a shared credential.</p>
        </div>
      </section>

      <hr />

      <section id="runtime">
        <h2>not just chat</h2>
        <p>Chat is one UI. BYOA exposes the agent runtime underneath it.</p>
        <RuntimeDiagram />
        <div className="capability-list">
          <div><strong>files</strong><span>upload, read, write, watch</span></div>
          <div><strong>tools</strong><span>app functions and MCP servers</span></div>
          <div><strong>instructions</strong><span>per thread or kept in the repo</span></div>
          <div><strong>hooks</strong><span>before and after agent actions</span></div>
          <div><strong>structured output</strong><span>JSON Schema per turn</span></div>
          <div><strong>events</strong><span>render any interface you want</span></div>
        </div>
        <p className="section-link"><a href="/docs#runtime">read the runtime docs →</a></p>
      </section>

      <hr />

      <section id="setup">
        <h2>setup</h2>
        <p>Requirements: Node 20+, Workers Paid, and Containers enabled. The command uses Wrangler OAuth locally or a scoped Cloudflare token in CI. Never paste a global Cloudflare API key into the browser.</p>

        <div className="setup-step">
          <h3>1. deploy the runner</h3>
          <pre><code>{`npx byoa deploy`}</code></pre>
          <p>The deploy command creates a backend secret when needed and prints the Worker URL. Store both in your app&apos;s server environment.</p>
        </div>

        <div className="setup-step">
          <h3>2. issue a browser session from your backend</h3>
          <pre><code>{`npm install byoa

import { BYOAServer } from "byoa/server";

const byoa = new BYOAServer({
  endpoint: process.env.BYOA_URL,
  secret: process.env.BYOA_APP_SECRET,
});

const session = await byoa.createSession({
  installationId: "your-app",
  userId: signedInUser.id,
  workspaceId: project.id,
});`}</code></pre>
        </div>

        <div className="setup-step">
          <h3>3. connect from the app</h3>
          <pre><code>{`import { BYOA } from "byoa";

const agent = new BYOA({
  endpoint: session.endpoint,
  token: session.token,
});

await agent.connect();
const login = await agent.startDeviceLogin();`}</code></pre>
          <p>Open the returned verification URL, show the user code, then listen for <code>account/login/completed</code>. Use <code>agent.threads</code>, <code>agent.turns</code>, <code>agent.workspace</code>, and the event stream to build your interface.</p>
        </div>
      </section>

      <hr />

      <section id="status">
        <h2>current status</h2>
        <dl className="status-list">
          <div><dt>landing + docs</dt><dd>live</dd></div>
          <div><dt>npm package</dt><dd>0.1.0 / release ready</dd></div>
          <div><dt>cloudflare runner</dt><dd>live / rate limited / container alpha</dd></div>
          <div><dt>durable agent credentials</dt><dd>not done</dd></div>
          <div><dt>install path</dt><dd>npm install byoa / npx byoa deploy</dd></div>
        </dl>
        <p>The public demo uses Turnstile, short-lived sessions, and per-user runner limits. Codex account persistence and hostile-workload isolation are still alpha.</p>
      </section>

      <hr />

      <section id="agent">
        <h2>give this to your coding agent</h2>
        <p>The endpoint returns plain Markdown with the current repository, deployment, security, and integration instructions.</p>
        <CopyCommand />
      </section>

      <footer>
        <span>byoa / apache-2.0</span>
        <span><a href={demoUrl}>demo</a> | <a href="/docs">docs</a> | <a href="https://github.com/rishabhsai/byoa">github</a></span>
      </footer>
    </main>
  );
}

function Docs() {
  return (
    <main className="page docs-page">
      <Header />
      <article>
        <p className="status">docs / alpha</p>
        <h1>byoa docs</h1>
        <p className="lead">The shortest path from an existing app to a user-authorized Codex runner.</p>

        <hr />
        <section id="start">
          <h2>start with the agent file</h2>
          <CopyCommand />
          <p>Give the command to your coding agent. It should inspect the repo&apos;s <code>AGENTS.md</code>, architecture, deploy, and security notes before editing your integration.</p>
        </section>

        <hr />
        <section id="boundaries">
          <h2>trust boundaries</h2>
          <FlowDiagram />
          <ul>
            <li>Cloudflare credentials stay with the developer and Wrangler.</li>
            <li><code>BYOA_APP_SECRET</code> stays in the developer backend.</li>
            <li>The browser receives only a short-lived runner session.</li>
            <li>Each installation, user, and workspace tuple gets a separate sandbox identity.</li>
            <li>Codex account state stays outside the working repository.</li>
          </ul>
        </section>

        <hr />
        <section id="protocol">
          <h2>protocol</h2>
          <p>BYOA speaks Codex app-server&apos;s JSON-RPC protocol over one authenticated WebSocket. Initialize the connection once, start or resume a thread, begin a turn, and render <code>item/agentMessage/delta</code> until <code>turn/completed</code>.</p>
          <pre><code>{`initialize → initialized
account/read → account/login/start
thread/start → turn/start
item/agentMessage/delta … turn/completed`}</code></pre>
        </section>

        <hr />
        <section id="runtime">
          <h2>agent runtime</h2>
          <p>The SDK keeps the full app-server surface. Use the typed helpers for common work and <code>request()</code> for protocol methods BYOA has not wrapped yet.</p>
          <pre><code>{`const agent = new BYOA({
  endpoint: session.endpoint,
  token: session.token,
  experimentalApi: true,
});

await agent.connect();
await agent.workspace.write("/workspace/invoice.txt", invoice);

const { thread } = await agent.threads.start({
  cwd: "/workspace",
  developerInstructions: "return a short risk report",
  sandbox: "workspace-write",
});

await agent.turns.start(thread.id, [
  { type: "text", text: "review the invoice" },
  { type: "localImage", path: "/workspace/scan.png" },
], {
  outputSchema: riskReportSchema,
});`}</code></pre>

          <div className="doc-grid">
            <div><h3>files</h3><p><code>agent.workspace</code> reads and writes the sandbox filesystem. Put user files under <code>/workspace</code>. Keep <code>CODEX_HOME</code> separate.</p></div>
            <div><h3>prompts</h3><p>Use thread instructions for app behavior, <code>AGENTS.md</code> for repo rules, skills for reusable workflows, and hooks for lifecycle enforcement.</p></div>
            <div><h3>output</h3><p>Pass text, inline images, local files, or audio. Stream items as they run. Add <code>outputSchema</code> when your app needs JSON.</p></div>
            <div><h3>images</h3><p>Check <code>agent.models.capabilities()</code>. Image-generation results arrive as <code>imageGeneration</code> items on <code>item/completed</code>.</p></div>
          </div>
        </section>

        <hr />
        <section id="tools">
          <h2>custom tools</h2>
          <p>For a small app-owned tool set, start a thread with experimental <code>dynamicTools</code>. Codex sends <code>item/tool/call</code> back to the client. Use MCP for durable tools shared across products.</p>
          <pre><code>{`const { thread } = await agent.threads.start({
  dynamicTools: [{
    type: "function",
    name: "lookup_order",
    description: "look up one order",
    inputSchema: { type: "object", properties: { id: { type: "string" } } },
  }],
});

const stop = agent.onToolCall(async (call) => {
  if (call.tool !== "lookup_order") throw new Error("unknown tool");

  // Browser-safe example. Put privileged work behind your backend.
  const order = await fetch("/api/tools/lookup-order", {
    method: "POST",
    body: JSON.stringify(call.arguments),
  }).then(r => r.json());
  return {
    contentItems: [{ type: "inputText", text: JSON.stringify(order) }],
    success: true,
  };
});`}</code></pre>
          <p>Never place database credentials or third-party secrets in a browser handler. The signed server-side tool router is still a BYOA milestone.</p>
        </section>

        <hr />
        <section id="limits">
          <h2>alpha limits</h2>
          <p>The current runner filesystem is ephemeral, dynamic tools use Codex&apos;s experimental protocol, and hostile-workload isolation needs a production security review. Durable account storage and the server-side tool router are not done.</p>
        </section>
      </article>
      <footer><span>byoa docs</span><a href="/">home</a></footer>
    </main>
  );
}

function App() {
  return window.location.pathname.startsWith("/docs") ? <Docs /> : <Landing />;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
