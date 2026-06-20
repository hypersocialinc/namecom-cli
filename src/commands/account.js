import { resolveCreds, storeCreds } from "../auth.js";
import { NameClient } from "../client.js";
import { globalsOf } from "../runtime.js";
import { emit } from "../output.js";

export function registerAccount(program) {
  program
    .command("login")
    .description("Verify and store Name.com API credentials (macOS Keychain, or ~/.config fallback)")
    .option("--user <user>", "Name.com API username")
    .option("--token <token>", "Name.com API token")
    .action(async (o, cmd) => {
      const opts = globalsOf(cmd);
      const user = o.user || process.env.NAMECOM_USER;
      const token = o.token || process.env.NAMECOM_TOKEN;
      if (!user || !token) {
        throw new Error("Provide --user and --token (or set NAMECOM_USER and NAMECOM_TOKEN).");
      }
      // Verify the credentials before persisting them.
      const c = new NameClient({ user, token, baseUrl: opts.apiUrl });
      await c.listDomains();
      const where = storeCreds(user, token);
      emit({ ok: true, stored_in: where, user }, opts);
    });

  program
    .command("whoami")
    .description("Show the active credentials and verify them against the API")
    .action(async (o, cmd) => {
      const opts = globalsOf(cmd);
      const { user, token } = resolveCreds(opts);
      if (!user || !token) {
        emit({ authenticated: false }, opts);
        process.exitCode = 1;
        return;
      }
      const c = new NameClient({ user, token, baseUrl: opts.apiUrl });
      const domains = await c.listDomains();
      emit({ authenticated: true, user, domains: domains.length }, opts);
    });
}
