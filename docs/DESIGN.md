# namecom-cli — design (v0.1)

## Goal

A small, reliable, agent-friendly CLI for Name.com DNS, on the current **v4 API**. Replaces both the automation-hostile web form and the dead `namedns` (v1) tool.

## Scope (v1)

- `records list/get/create/update/delete/set` (`set` = idempotent upsert)
- `domains list` (read-only)
- `login` / `whoami`
- `commands` (JSON introspection of the whole tree)

**Non-goals (v1):** nameservers, URL forwarding, domain registration/transfer/renewal/contacts. Deferred until there's real demand — kept cheap by the layering below.

## Architecture

Two layers, intentionally separate so a second registrar could later be extracted into a shared core:

- **`src/client.js`** — `NameClient`: HTTP + basic auth + v4 endpoints. Knows nothing about the CLI.
- **`src/commands/*.js`** — thin command modules (`records`, `domains`, `account`) that parse args, call the client, and emit output.
- **`src/runtime.js`** — shared helpers (`clientFrom`, host normalization, record formatting, upsert classification).
- **`src/auth.js`** — credential resolution & storage.
- **`src/output.js`** — the one place that decides JSON vs table.
- **`src/cli.js`** — wires commander, adds `commands` introspection, top-level error handling.

## Auth

Read precedence: `--user/--token` → `NAMECOM_USER`/`NAMECOM_TOKEN` → macOS Keychain (`namecom_user`/`namecom_token`) → `~/.config/namecom/credentials.json`.
Write: Keychain on macOS, else a `0600` config file. Never the global shell environment.

## Idempotent `set`

For `(host, type)`: exact-answer match → `unchanged`; single-valued type (CNAME/ANAME) with a different value → `update`; else → `create`. This avoids the duplicate-record footgun of raw `create`.

## Output

`--json` on any command → pretty JSON to stdout. Errors → `{ "error": { message, status, data } }` on stderr (JSON when `--json`), exit code 1. Default human output is a `console.table`.

## Distribution

- **npm:** `namecom-cli`, binary `namecom` (scoped `@hypersocialinc/namecom` is a publish-day option, no code impact).
- **skills:** co-located `skills/namecom/SKILL.md`, installable via `npx skills add hypersocialinc/namecom-cli --skill namecom`.

## Naming decision

`namecom-cli` (discoverable) over a generic `domain-manager` (speculative). The "umbrella" for multi-provider tooling is the GitHub org + skills catalog, not a mega-CLI. Internal layering keeps generalization cheap if a second provider ever lands.
