// Shared helpers used by every command module.

import { resolveCreds } from "./auth.js";
import { NameClient } from "./client.js";

// Record types that may only have ONE value per host. For these, `records set`
// updates in place; for multi-valued types (TXT, MX, A, ...) it appends.
export const SINGLE_VALUED = new Set(["CNAME", "ANAME"]);

export function clientFrom(opts) {
  const { user, token } = resolveCreds(opts);
  if (!user || !token) {
    throw new Error(
      "No Name.com credentials found. Run `namecom login --user <u> --token <t>` " +
        "or set NAMECOM_USER and NAMECOM_TOKEN."
    );
  }
  return new NameClient({ user, token, baseUrl: opts.apiUrl });
}

// Merge a subcommand's own options with the root program's global options.
export function globalsOf(cmd) {
  return cmd.optsWithGlobals();
}

// Normalize a host argument: "@" and "" both mean the zone apex (root).
export function normHost(host) {
  return host === "@" || host == null ? "" : host;
}

// Compact, table-friendly view of a Name.com record.
export function fmtRec(r) {
  return {
    id: r.id,
    type: r.type,
    host: r.host || "@",
    answer: r.answer,
    ttl: r.ttl,
    priority: r.priority ?? "",
    fqdn: r.fqdn,
  };
}

export function buildRecordBody(o) {
  const body = {
    host: normHost(o.host),
    type: o.type.toUpperCase(),
    answer: o.answer,
    ttl: Number(o.ttl ?? 300),
  };
  if (o.priority != null) body.priority = Number(o.priority);
  return body;
}
