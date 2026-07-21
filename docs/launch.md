# launch

BYOA 0.1.0 is an alpha. Launch it as developer infrastructure, not as a durability or security guarantee.

## release checks

```bash
npm ci
npm run check
npm run build
npm pack --workspace @rishabhsai/byoa --dry-run
```

Verify the live surfaces:

- `https://byoa.lol` returns the landing page.
- `https://byoa.lol/agent` returns the agent setup file.
- `https://demo.byoa.lol` renders Turnstile before connect.
- the runner health endpoint returns `acceptingSessions: true`.
- a valid demo token creates a session; missing or replayed tokens return `403`.
- the sixth session request for one user within a minute returns `429`.
- the npm package installs in an empty directory and `byoa --version` prints `0.1.0`.

## connect byoa.lol

The domain currently uses Porkbun nameservers. Add `byoa.lol` to Cloudflare, then replace the four Porkbun nameservers at the registrar with the two nameservers Cloudflare assigns. Do not add guessed A records.

After Cloudflare marks the zone active, attach these Pages custom domains:

- `byoa.lol` and `www.byoa.lol` → Pages project `byoa`.
- `demo.byoa.lol` → Pages project `byoa-demo`.

Cloudflare creates and proxies the needed DNS records and certificates. Keep the `pages.dev` addresses as recovery origins, not public canonical URLs.

## cloudflare values

GitHub Actions:

- variable `CLOUDFLARE_ACCOUNT_ID`
- variable `TURNSTILE_SITE_KEY`
- secret `CLOUDFLARE_API_TOKEN`

Pages project `byoa-demo`:

- secret `BYOA_URL`
- secret `BYOA_APP_SECRET`
- secret `DEMO_COOKIE_SECRET`
- variable `TURNSTILE_VERIFY_URL`

Runner Worker:

- secret `BYOA_APP_SECRET`
- optional emergency secret `BYOA_DISABLED=1`

## rollback

Set `BYOA_DISABLED=1` first when paid compute or isolation is at risk. Roll back the Pages and Worker deployments in Cloudflare, or redeploy the previous Git commit through GitHub Actions. Do not rotate `BYOA_APP_SECRET` casually: every app backend using the runner must change at the same time.

## known launch limits

- sandbox files and Codex login state are ephemeral.
- dynamic tools depend on an experimental app-server surface.
- privileged tools require an authenticated MCP server or independently authenticated backend route.
- the current isolation model still needs a hostile-workload review before a production claim.
