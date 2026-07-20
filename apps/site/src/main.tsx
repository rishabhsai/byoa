import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const agentCommand = "curl -fsSL https://byoa.dev/agent";

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

function Landing() {
  return (
    <main>
      <header className="nav wrap">
        <a className="wordmark" href="#top">byoa</a>
        <nav aria-label="main navigation">
          <a href="#use">use</a>
          <a href="/docs">docs</a>
          <a href="https://github.com/rishabhsai/byoa">github</a>
        </nav>
      </header>

      <section className="hero wrap" id="top">
        <p className="status"><span /> open source · early</p>
        <h1>BYOA</h1>
        <p className="dek">bring your <a href="#agent">agent</a></p>
        <div className="hero-bottom">
          <CopyCommand />
          <p>your cloud.<br />their account.</p>
        </div>
      </section>

      <section className="section wrap" id="use">
        <div className="section-index">01 / use</div>
        <div className="section-body">
          <h2>one runner.<br />one sdk.</h2>
          <pre className="code"><code>{`import { BYOA } from "@byoa/sdk";

const agent = new BYOA({
  endpoint: process.env.BYOA_URL,
  token: await getSessionToken(user.id),
});

await agent.connect();`}</code></pre>
        </div>
      </section>

      <section className="section wrap">
        <div className="section-index">02 / run</div>
        <div className="section-body steps">
          <div><b>deploy</b><p>the runner lives in your Cloudflare account.</p></div>
          <div><b>connect</b><p>the user signs in with their agent account.</p></div>
          <div><b>run</b><p>requests use their plan, inside their sandbox.</p></div>
        </div>
      </section>

      <section className="section wrap agent-section" id="agent">
        <div className="section-index">03 / agent</div>
        <div className="section-body">
          <h2>send the docs<br />to your agent.</h2>
          <CopyCommand />
          <p className="note">plain markdown. current setup. no shell pipe.</p>
        </div>
      </section>

      <footer className="wrap">
        <span>BYOA</span>
        <span>apache-2.0</span>
        <a href="https://github.com/rishabhsai/byoa">source →</a>
      </footer>
    </main>
  );
}

function Docs() {
  return (
    <main className="docs-shell wrap">
      <header className="nav">
        <a className="wordmark" href="/">byoa</a>
        <nav><a href="/">home</a><a href="https://github.com/rishabhsai/byoa">github</a></nav>
      </header>
      <article className="docs">
        <aside><span>docs</span><a href="#start">start</a><a href="#shape">shape</a><a href="#security">security</a></aside>
        <div>
          <p className="eyebrow">docs / 00</p>
          <h1>bring your own agent.</h1>
          <section id="start"><h2>start</h2><CopyCommand /><p>give this line to your coding agent. it returns the current setup instructions as markdown.</p></section>
          <section id="shape"><h2>shape</h2><pre className="code"><code>{`your app
  └─ byoa worker
      └─ user sandbox
          └─ codex app-server`}</code></pre><p>you own the Cloudflare deployment. each user and workspace gets a separate runner.</p></section>
          <section id="security"><h2>security</h2><p>deployment secrets stay on your backend. browsers receive short-lived session tokens. agent credentials never share a workspace snapshot.</p></section>
        </div>
      </article>
    </main>
  );
}

function App() {
  return window.location.pathname.startsWith("/docs") ? <Docs /> : <Landing />;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
