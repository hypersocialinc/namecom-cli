---
name: namecom
description: Use when managing Name.com DNS records or domains from the command line — listing/creating/updating/deleting records, idempotently upserting records (e.g. adding DKIM/SPF/DMARC or CNAME verification records for Resend, SES, Vercel, Clerk, Google), or auditing what a domain points at. Trigger on "name.com", "namecom", "add a DNS record", "verify my sending domain", "set up DKIM/SPF". Drives the `namecom` CLI (Name.com v4 API).
---

# Name.com DNS via the `namecom` CLI

## Overview

**Core principle:** never click around the Name.com web dashboard to manage DNS — its form is automation-hostile and silently drops programmatic submits. Use the `namecom` CLI, which talks to the v4 REST API directly. Prefer `records set` (idempotent upsert) over `records create` so re-runs never produce duplicate records.

## Setup

Requires the CLI on PATH:

```bash
npm install -g namecom-cli      # or: npx namecom-cli ...
```

Auth (production token from https://www.name.com/account/settings/api):

```bash
namecom login --user <username> --token <token>   # stored in macOS Keychain
# or set NAMECOM_USER / NAMECOM_TOKEN in the environment
namecom whoami                                     # verify
```

## Discovering the surface

Always available for introspection — call this first if unsure:

```bash
namecom commands        # full command tree as JSON
namecom <cmd> --json    # structured output for any command
```

## Key commands

```bash
namecom domains list
namecom records list <domain> [--type TXT] [--host send]
namecom records get <domain> <id>
namecom records create <domain> --host <h> --type <T> --answer <v> [--ttl 300] [--priority 10]
namecom records update <domain> <id> [--answer ... --ttl ...]
namecom records delete <domain> <id>
namecom records set <domain> --host <h> --type <T> --answer <v> [--ttl 300] [--priority 10]
```

## Rules that matter

- **Host is relative to the domain.** On `example.com`, `--host send` → `send.example.com`. Use `--host '@'` for the zone apex (root).
- **For a subdomain sending setup** (domain is `mail.example.com` but the zone is `example.com`), the host already includes the extra label: `--host 'resend._domainkey.mail'`, `--host 'send.mail'`.
- **`set` is idempotent.** It looks up existing records with the same host+type: exact match → no-op (`"unchanged"`); single-valued type (CNAME/ANAME) with a different value → update; otherwise → create. Safe to re-run.
- **TXT values** (DKIM keys, SPF) go in `--answer` verbatim, no surrounding quotes. They can contain `+`, `/`, `=` — fine.
- **MX needs `--priority`.**
- Add `--api-url https://api.dev.name.com` to hit the sandbox.

## Worked example — verify a Resend sending domain on `decks.example.com`

```bash
# DKIM
namecom records set example.com --host 'resend._domainkey.decks' --type TXT --answer 'p=MIGf...IDAQAB'
# SES MAIL FROM (SPF)
namecom records set example.com --host 'send.decks' --type MX  --answer 'feedback-smtp.us-east-1.amazonses.com' --priority 10
namecom records set example.com --host 'send.decks' --type TXT --answer 'v=spf1 include:amazonses.com ~all'
# confirm
namecom records list example.com --json | jq '.[] | select(.host|test("decks"))'
```

Then trigger verification in the provider (e.g. `resend domains verify <id>`), and confirm public DNS with `dig +short TXT resend._domainkey.decks.example.com @8.8.8.8`.

## Anti-patterns

- ❌ Editing records in the Name.com web UI for anything scriptable — it's unreliable and not reproducible.
- ❌ `records create` in a loop / re-run — produces duplicate records. Use `records set`.
- ❌ Putting the API token in `~/.zshrc` / global env — use `namecom login` (Keychain) or a scoped env var.
