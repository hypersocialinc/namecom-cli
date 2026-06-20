# namecom-cli

A fast, **agent-friendly** command-line tool for [Name.com](https://www.name.com) DNS and domains, built on the current **v4 API**.

- **`--json` everywhere** + a `commands` introspection command, so AI agents can discover and drive the whole surface
- **Idempotent `records set`** (create-or-update, never duplicate) — the right primitive for automation and IaC
- **Secure auth** — credentials live in the macOS Keychain (or a `0600` config file), never in your shell environment
- **Zero native dependencies** — just Node 18+ and `commander`

> Why this exists: the only prior community tool (`namedns`) has been unmaintained since 2018 and targets Name.com's dead v1 reseller API. `namecom-cli` uses the current v4 API and is designed to be driven by humans and agents alike.

## Install

```bash
# one-off
npx namecom-cli --help

# or globally
npm install -g namecom-cli
namecom --help
```

### Install the agent skill

This repo ships a Claude/Codex skill that teaches an agent to drive the CLI:

```bash
npx skills add hypersocialinc/namecom-cli --skill namecom --agent claude-code
# or: --agent codex
```

## Authenticate

Create a **production** API token at <https://www.name.com/account/settings/api> (you get a username + token), then:

```bash
namecom login --user <username> --token <token>
```

`login` verifies the credentials, then stores them in your macOS Keychain (`namecom_user` / `namecom_token`). You can also just set `NAMECOM_USER` / `NAMECOM_TOKEN` in the environment and skip `login`.

Resolution order on every command: `--user/--token` flags → env vars → Keychain → `~/.config/namecom/credentials.json`.

## Usage

```bash
namecom whoami                          # verify auth, show domain count
namecom domains list                    # list every domain in the account

namecom records list example.com                 # all records
namecom records list example.com --type TXT      # filter by type
namecom records list example.com --host send     # filter by host

namecom records create example.com --host www --type CNAME --answer example.vercel.app
namecom records update example.com 12345 --ttl 600
namecom records delete example.com 12345

# Idempotent upsert — safe to run repeatedly, never creates duplicates:
namecom records set example.com --host send --type MX \
  --answer feedback-smtp.us-east-1.amazonses.com --priority 10
```

Add `--json` to any command for machine-readable output, and `--api-url https://api.dev.name.com` to target the sandbox.

### Real example: verifying a Resend sending domain

```bash
namecom records set example.com --host 'resend._domainkey.mail' --type TXT --answer 'p=MIGf...'
namecom records set example.com --host 'send.mail' --type MX --answer 'feedback-smtp.us-east-1.amazonses.com' --priority 10
namecom records set example.com --host 'send.mail' --type TXT --answer 'v=spf1 include:amazonses.com ~all'
```

## For agents

```bash
namecom commands         # full command tree as JSON
namecom <cmd> --json     # structured output for any command
```

`@` means the zone apex (root). Hosts are relative to the domain (e.g. host `send` on `example.com` → `send.example.com`).

## Notes & non-goals (v1)

- Scope is **DNS records** (`list/get/create/update/delete/set`) and read-only **`domains list`**.
- Not (yet) covered: nameservers, URL forwarding, domain registration/transfer/contacts. The `client/` layer is kept separate from commands so these are easy to add.
- This is an unofficial tool and is not affiliated with Name.com.

## License

MIT © Hypersocial, Inc.
