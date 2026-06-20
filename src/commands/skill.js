import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { globalsOf } from "../runtime.js";
import { emit } from "../output.js";

const REPO = "hypersocialinc/namecom-cli";
const SKILL = "namecom";

// The argv handed to the official `skills` CLI. Pure, so it's unit-tested.
export function skillInstallArgs(agent) {
  return ["skills", "add", REPO, "--skill", SKILL, "--agent", agent];
}

// Absolute path to the SKILL.md bundled inside this package (shipped via the
// `files` array), resolved relative to this module so it works whether the CLI
// was installed globally or run through npx.
export function bundledSkillPath() {
  return fileURLToPath(new URL("../../skills/namecom/SKILL.md", import.meta.url));
}

export function registerSkill(program) {
  const skill = program
    .command("skill")
    .description("Install or locate the namecom agent skill");

  skill
    .command("install")
    .description("Install the agent skill into your agent (delegates to the `skills` CLI)")
    .option("--agent <agent>", "target agent (claude-code, codex, ...)", "claude-code")
    .option("--print", "print the install command instead of running it")
    .action((o, cmd) => {
      const opts = globalsOf(cmd);
      const args = skillInstallArgs(o.agent);
      if (o.print) {
        emit(
          opts.json ? { command: ["npx", "-y", ...args] } : `npx -y ${args.join(" ")}`,
          opts
        );
        return;
      }
      const res = spawnSync("npx", ["-y", ...args], { stdio: "inherit" });
      if (res.status !== 0) {
        process.stderr.write(
          "\n✖ Couldn't run the skills installer. Install offline by copying the bundled skill:\n" +
            '    mkdir -p ~/.claude/skills/namecom && cp "$(namecom skill path)" ~/.claude/skills/namecom/SKILL.md\n'
        );
        process.exit(res.status || 1);
      }
    });

  skill
    .command("path")
    .description("Print the path to the bundled SKILL.md (for manual/offline install)")
    .action((o, cmd) => {
      const opts = globalsOf(cmd);
      const p = bundledSkillPath();
      if (!existsSync(p)) throw new Error(`Bundled skill not found at ${p}`);
      emit(opts.json ? { path: p } : p, opts);
    });
}
