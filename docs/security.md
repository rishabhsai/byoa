# security

The runner executes model-directed shell commands. Treat every repository, prompt, dependency, and generated file as untrusted.

## invariants

1. one sandbox per installation, user, and workspace
2. no deployment secret in the browser
3. no shared `CODEX_HOME`
4. no credential files in `/workspace`
5. no public app-server port
6. explicit approval for privileged actions
7. short-lived browser session tokens

Before release, validate that a hostile prompt cannot read `CODEX_HOME`, other sandboxes, Worker secrets, or R2 credentials.
