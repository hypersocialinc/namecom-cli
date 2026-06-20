import { clientFrom, globalsOf } from "../runtime.js";
import { emit } from "../output.js";

export function registerDomains(program) {
  const domains = program.command("domains").description("Manage domains");

  domains
    .command("list")
    .alias("ls")
    .description("List domains in the account")
    .action(async (o, cmd) => {
      const opts = globalsOf(cmd);
      const c = clientFrom(opts);
      const list = await c.listDomains();
      emit(
        opts.json
          ? list
          : list.map((d) => ({
              domain: d.domainName,
              expires: d.expireDate || "",
              autorenew: d.autorenewEnabled ? "yes" : "no",
              locked: d.locked ? "yes" : "no",
            })),
        opts
      );
    });
}
