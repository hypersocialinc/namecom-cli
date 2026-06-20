import {
  clientFrom,
  globalsOf,
  fmtRec,
  normHost,
  buildRecordBody,
  SINGLE_VALUED,
} from "../runtime.js";
import { emit } from "../output.js";

export function registerRecords(program) {
  const records = program.command("records").description("Manage DNS records");

  records
    .command("list <domain>")
    .alias("ls")
    .description("List DNS records for a domain")
    .option("--type <type>", "filter by record type (A, TXT, MX, ...)")
    .option("--host <host>", "filter by host (use '@' for root)")
    .action(async (domain, o, cmd) => {
      const opts = globalsOf(cmd);
      const c = clientFrom(opts);
      let recs = await c.listRecords(domain);
      if (o.type) recs = recs.filter((r) => r.type === o.type.toUpperCase());
      if (o.host !== undefined) {
        recs = recs.filter((r) => (r.host || "") === normHost(o.host));
      }
      emit(opts.json ? recs : recs.map(fmtRec), opts);
    });

  records
    .command("get <domain> <id>")
    .description("Get a single DNS record by id")
    .action(async (domain, id, o, cmd) => {
      const opts = globalsOf(cmd);
      const c = clientFrom(opts);
      const r = await c.getRecord(domain, id);
      emit(opts.json ? r : fmtRec(r), opts);
    });

  records
    .command("create <domain>")
    .description("Create a DNS record")
    .requiredOption("--host <host>", "subdomain (use '@' for root)")
    .requiredOption("--type <type>", "record type (A, AAAA, CNAME, TXT, MX, ...)")
    .requiredOption("--answer <answer>", "record value")
    .option("--ttl <ttl>", "time to live in seconds", "300")
    .option("--priority <priority>", "priority (MX/SRV)")
    .action(async (domain, o, cmd) => {
      const opts = globalsOf(cmd);
      const c = clientFrom(opts);
      const r = await c.createRecord(domain, buildRecordBody(o));
      emit(opts.json ? r : fmtRec(r), opts);
    });

  records
    .command("update <domain> <id>")
    .description("Update an existing DNS record (unset fields keep their value)")
    .option("--host <host>", "subdomain (use '@' for root)")
    .option("--type <type>", "record type")
    .option("--answer <answer>", "record value")
    .option("--ttl <ttl>", "time to live in seconds")
    .option("--priority <priority>", "priority (MX/SRV)")
    .action(async (domain, id, o, cmd) => {
      const opts = globalsOf(cmd);
      const c = clientFrom(opts);
      const cur = await c.getRecord(domain, id);
      const body = {
        host: o.host !== undefined ? normHost(o.host) : cur.host || "",
        type: (o.type || cur.type).toUpperCase(),
        answer: o.answer ?? cur.answer,
        ttl: o.ttl != null ? Number(o.ttl) : cur.ttl,
      };
      if (o.priority != null) body.priority = Number(o.priority);
      else if (cur.priority != null) body.priority = cur.priority;
      const r = await c.updateRecord(domain, id, body);
      emit(opts.json ? r : fmtRec(r), opts);
    });

  records
    .command("delete <domain> <id>")
    .alias("rm")
    .description("Delete a DNS record by id")
    .option("-y, --yes", "skip confirmation (implied in non-interactive use)")
    .action(async (domain, id, o, cmd) => {
      const opts = globalsOf(cmd);
      const c = clientFrom(opts);
      await c.deleteRecord(domain, id);
      emit({ deleted: true, id: Number(id) }, opts);
    });

  records
    .command("set <domain>")
    .description("Idempotently ensure a record exists — create or update, never duplicate")
    .requiredOption("--host <host>", "subdomain (use '@' for root)")
    .requiredOption("--type <type>", "record type")
    .requiredOption("--answer <answer>", "record value")
    .option("--ttl <ttl>", "time to live in seconds", "300")
    .option("--priority <priority>", "priority (MX/SRV)")
    .action(async (domain, o, cmd) => {
      const opts = globalsOf(cmd);
      const c = clientFrom(opts);
      const type = o.type.toUpperCase();
      const host = normHost(o.host);

      const existing = (await c.listRecords(domain)).filter(
        (r) => (r.host || "") === host && r.type === type
      );
      const exact = existing.find((r) => r.answer === o.answer);
      const body = buildRecordBody(o);

      let action, record;
      if (exact) {
        action = "unchanged";
        record = exact;
      } else if (SINGLE_VALUED.has(type) && existing.length) {
        action = "updated";
        record = await c.updateRecord(domain, existing[0].id, body);
      } else {
        action = "created";
        record = await c.createRecord(domain, body);
      }
      emit(opts.json ? { action, record } : { action, ...fmtRec(record) }, opts);
    });
}
