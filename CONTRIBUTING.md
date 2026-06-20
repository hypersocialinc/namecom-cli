# Contributing

`namecom-cli` is **v1 of a provider-agnostic "agents can do DNS" tool**. Today it
speaks Name.com's v4 API; the goal is for the same agent-friendly surface
(`--json`, idempotent `set`, `commands` introspection) to work across registrars.
**Adding a new provider is the most valuable contribution you can make** — see
[Adding a provider](#adding-a-provider).

## Dev setup

Requires Node ≥ 20.12.

```bash
git clone https://github.com/hypersocialinc/namecom-cli
cd namecom-cli
npm install
npm test                 # node:test unit suite
node bin/namecom.js --help
node bin/namecom.js commands   # JSON tree of the whole surface
```

## Project layout

| Path | Responsibility |
|------|----------------|
| `src/client.js` | `NameClient` — HTTP + auth + the v4 API. **Knows nothing about the CLI.** This is the provider contract. |
| `src/commands/*.js` | Thin CLI commands (`records`, `domains`, `account`, `skill`). Parse args → call the client → `emit`. |
| `src/runtime.js` | Shared helpers: `clientFrom`, host normalization, record formatting, the pure `classifyUpsert` upsert decision. |
| `src/auth.js` | Credential resolution & storage (flags → env → Keychain → config). |
| `src/ui.js` | The single `interactive()` gate + spinner/color helpers. |
| `src/output.js` | The one place that decides JSON vs table. |
| `src/cli.js` | Wires commander, the `commands` introspection, top-level error handling. |
| `skills/namecom/SKILL.md` | The bundled agent skill. |

## Principles (please keep these)

- **Agent-first.** `--json` must work on every command, and piped / `--json` /
  non-TTY runs must stay 100% non-interactive and deterministic — no prompts, no
  spinners, no color. The `interactive()` gate in `src/ui.js` enforces this.
- **Idempotent by default.** Prefer create-or-update semantics (`records set`)
  over operations that duplicate on re-run.
- **No secrets in the environment.** Credentials live in the OS keychain or a
  `0600` config file, never a global `export`.
- **Few, pure-JS dependencies.** No native modules.
- **Test the pure logic.** Decision functions (like `classifyUpsert`) should be
  unit-tested without network.

## Adding a provider

We intentionally have **not** built a provider abstraction yet — you'd be guessing
the seams without a second provider in hand. So: **open an issue first** (or take
one of the `provider:` issues) and we'll extract the shared interface together as
your provider lands. That keeps the abstraction honest.

The contract a provider must satisfy is exactly the shape of `NameClient` in
`src/client.js`:

```js
class Provider {
  // Domains
  listDomains()                 // -> [{ domainName, expireDate?, ... }]
  // Records
  listRecords(domain)           // -> [{ id, host, type, answer, ttl, priority?, fqdn }]
  getRecord(domain, id)         // -> record
  createRecord(domain, body)    // body: { host, type, answer, ttl, priority? }
  updateRecord(domain, id, body)
  deleteRecord(domain, id)
}
```

Expected direction (we'll formalize it with you):

1. Move `NameClient` to `src/providers/namecom.js`.
2. Add your provider as `src/providers/<name>.js` implementing the same methods.
3. Select it via a `--provider <name>` flag / `NAMEDNS_PROVIDER` env, resolved in
   `clientFrom` (`src/runtime.js`).
4. Keep auth pluggable per provider in `src/auth.js`.

Bring tests for any pure mapping logic, and make sure `--json` output stays
consistent across providers.

## Commits & PRs

- Small, focused PRs. Match the existing style (ESM, no heavy deps).
- `npm test` must pass; CI runs Node 20/22/24.
- Describe the user-facing change in the PR body.

Thanks for helping make DNS something agents can just *do*. 🙌
