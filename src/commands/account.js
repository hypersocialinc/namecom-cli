import { resolveCreds, storeCreds } from "../auth.js";
import { NameClient } from "../client.js";
import { globalsOf } from "../runtime.js";
import { emit } from "../output.js";
import { interactive, task, clack, pc, openUrl } from "../ui.js";

export const TOKEN_URL = "https://www.name.com/account/settings/api";

export function registerAccount(program) {
  program
    .command("login")
    .description("Verify and store Name.com API credentials (macOS Keychain, or ~/.config fallback)")
    .option("--user <user>", "Name.com API username")
    .option("--token <token>", "Name.com API token")
    .action(async (o, cmd) => {
      const opts = globalsOf(cmd);
      let user = o.user || process.env.NAMECOM_USER;
      let token = o.token || process.env.NAMECOM_TOKEN;

      // Prompt for anything missing — but only for a human at a TTY.
      if ((!user || !token) && interactive(opts)) {
        clack.intro(pc.cyan("namecom login"));
        if (!user) {
          user = await clack.text({
            message: "Name.com API username",
            validate: (v) => (v ? undefined : "Required"),
          });
          if (clack.isCancel(user)) {
            clack.cancel("Aborted.");
            process.exit(1);
          }
        }
        if (!token) {
          // Name.com has no API to mint a token, so help the user grab one:
          // show the page and offer to open it in their browser.
          clack.note(pc.underline(TOKEN_URL), "Create a production API token at");
          const open = await clack.confirm({
            message: "Open that page in your browser now?",
            initialValue: true,
          });
          if (clack.isCancel(open)) {
            clack.cancel("Aborted.");
            process.exit(1);
          }
          if (open) {
            openUrl(TOKEN_URL);
            clack.log.info(`Opened ${TOKEN_URL}`);
          }
          token = await clack.password({
            message: "Paste your Name.com API token",
            validate: (v) => (v ? undefined : "Required"),
          });
          if (clack.isCancel(token)) {
            clack.cancel("Aborted.");
            process.exit(1);
          }
        }
      }

      if (!user || !token) {
        throw new Error("Provide --user and --token (or set NAMECOM_USER and NAMECOM_TOKEN).");
      }

      const c = new NameClient({ user, token, baseUrl: opts.apiUrl });
      await task(opts, "Verifying credentials", () => c.listDomains());
      const where = storeCreds(user, token);

      if (interactive(opts)) clack.outro(pc.green(`✓ Stored in ${where} for ${user}`));
      else emit({ ok: true, stored_in: where, user }, opts);
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
      const domains = await task(opts, "Checking credentials", () => c.listDomains());
      emit({ authenticated: true, user, domains: domains.length }, opts);
    });
}
