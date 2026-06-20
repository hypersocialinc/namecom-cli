import { createRequire } from "node:module";
import { Command } from "commander";
import { registerAccount } from "./commands/account.js";
import { registerDomains } from "./commands/domains.js";
import { registerRecords } from "./commands/records.js";
import { registerSkill } from "./commands/skill.js";

const require = createRequire(import.meta.url);
const VERSION = require("../package.json").version;

export function buildProgram() {
  const program = new Command();

  program
    .name("namecom")
    .description("Agent-friendly CLI for Name.com DNS & domains (v4 API)")
    .version(VERSION)
    .option("--json", "output JSON instead of a table")
    .option(
      "--api-url <url>",
      "API base URL (default https://api.name.com; sandbox: https://api.dev.name.com)"
    )
    .option("-u, --user <user>", "Name.com API username (overrides env/keychain)")
    .option("-t, --token <token>", "Name.com API token (overrides env/keychain)");

  registerAccount(program);
  registerDomains(program);
  registerRecords(program);
  registerSkill(program);

  program
    .command("commands")
    .description("Print the full command tree as JSON (for agents & tooling)")
    .action(() => {
      process.stdout.write(JSON.stringify(commandTree(program), null, 2) + "\n");
    });

  return program;
}

// Walk the commander tree into plain JSON so an agent can discover the whole
// surface in one call (mirrors the Resend CLI's `commands` command).
export function commandTree(cmd) {
  return {
    name: cmd.name(),
    description: cmd.description() || undefined,
    aliases: typeof cmd.aliases === "function" ? cmd.aliases() : [],
    options: cmd.options.map((o) => ({
      flags: o.flags,
      description: o.description || undefined,
      default: o.defaultValue,
    })),
    commands: cmd.commands
      .filter((c) => c.name() !== "commands")
      .map(commandTree),
  };
}

export async function run(argv) {
  const program = buildProgram();
  const json = argv.includes("--json");
  try {
    await program.parseAsync(argv);
  } catch (err) {
    const payload = {
      error: { message: err.message, status: err.status, data: err.data },
    };
    if (json) process.stderr.write(JSON.stringify(payload) + "\n");
    else process.stderr.write(`✖ ${err.message}\n`);
    process.exit(1);
  }
}
