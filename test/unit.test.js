import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  normHost,
  fmtRec,
  buildRecordBody,
  classifyUpsert,
} from "../src/runtime.js";
import { buildProgram, commandTree } from "../src/cli.js";
import { skillInstallArgs, bundledSkillPath } from "../src/commands/skill.js";
import { TOKEN_URL } from "../src/commands/account.js";
import { interactive, openUrl } from "../src/ui.js";

test("normHost: @ and undefined are the zone apex", () => {
  assert.equal(normHost("@"), "");
  assert.equal(normHost(undefined), "");
  assert.equal(normHost(null), "");
  assert.equal(normHost("send"), "send");
});

test("buildRecordBody: defaults, coercion, and apex", () => {
  const body = buildRecordBody({ host: "@", type: "txt", answer: "v=spf1 ~all" });
  assert.deepEqual(body, { host: "", type: "TXT", answer: "v=spf1 ~all", ttl: 300 });

  const mx = buildRecordBody({ host: "send", type: "mx", answer: "mail.x.com", ttl: "600", priority: "10" });
  assert.deepEqual(mx, { host: "send", type: "MX", answer: "mail.x.com", ttl: 600, priority: 10 });
  assert.equal(typeof mx.ttl, "number");
  assert.equal(typeof mx.priority, "number");

  // priority omitted when not provided
  assert.equal("priority" in buildRecordBody({ host: "w", type: "A", answer: "1.2.3.4" }), false);
});

test("fmtRec: apex host and empty priority render cleanly", () => {
  assert.deepEqual(
    fmtRec({ id: 1, type: "TXT", host: "", answer: "x", ttl: 300, fqdn: "example.com." }),
    { id: 1, type: "TXT", host: "@", answer: "x", ttl: 300, priority: "", fqdn: "example.com." }
  );
  assert.equal(fmtRec({ id: 2, type: "MX", host: "send", answer: "m", ttl: 300, priority: 10, fqdn: "send.example.com." }).priority, 10);
});

test("classifyUpsert: exact answer is a no-op", () => {
  const existing = [{ id: 1, type: "TXT", answer: "v=spf1 include:amazonses.com ~all" }];
  const r = classifyUpsert(existing, "TXT", "v=spf1 include:amazonses.com ~all");
  assert.equal(r.action, "unchanged");
  assert.equal(r.target.id, 1);
});

test("classifyUpsert: single-valued type updates in place", () => {
  const existing = [{ id: 7, type: "CNAME", answer: "old.vercel.app" }];
  const r = classifyUpsert(existing, "CNAME", "new.vercel.app");
  assert.equal(r.action, "updated");
  assert.equal(r.target.id, 7);
});

test("classifyUpsert: multi-valued type with a different answer creates (no dupe of exact)", () => {
  const existing = [{ id: 3, type: "TXT", answer: "v=spf1 a ~all" }];
  const r = classifyUpsert(existing, "TXT", "p=DKIMKEY");
  assert.equal(r.action, "created");
  assert.equal(r.target, null);
});

test("classifyUpsert: nothing existing creates", () => {
  const r = classifyUpsert([], "MX", "mail.x.com");
  assert.equal(r.action, "created");
});

test("commandTree: agent introspection exposes the surface and hides itself", () => {
  const tree = commandTree(buildProgram());
  assert.equal(tree.name, "namecom");
  const names = tree.commands.map((c) => c.name);
  assert.ok(names.includes("records"));
  assert.ok(names.includes("domains"));
  assert.ok(names.includes("login"));
  // `commands` should not list itself
  assert.ok(!names.includes("commands"));
  // global --json option is discoverable
  assert.ok(tree.options.some((o) => o.flags.includes("--json")));
  // records subcommands include the idempotent `set`
  const records = tree.commands.find((c) => c.name === "records");
  assert.ok(records.commands.some((c) => c.name === "set"));
  // the skill installer is exposed too
  const skill = tree.commands.find((c) => c.name === "skill");
  assert.ok(skill && skill.commands.some((c) => c.name === "install"));
});

test("skillInstallArgs: delegates to the skills CLI for the chosen agent", () => {
  assert.deepEqual(skillInstallArgs("claude-code"), [
    "skills",
    "add",
    "hypersocialinc/namecom-cli",
    "--skill",
    "namecom",
    "--agent",
    "claude-code",
  ]);
  assert.equal(skillInstallArgs("codex").at(-1), "codex");
});

test("bundledSkillPath: resolves to an existing SKILL.md", () => {
  const p = bundledSkillPath();
  assert.ok(p.endsWith("/skills/namecom/SKILL.md"));
  assert.ok(existsSync(p));
});

test("interactive: only true for a human TTY without --json", () => {
  const tty = { stdin: { isTTY: true }, stdout: { isTTY: true } };
  const piped = { stdin: { isTTY: false }, stdout: { isTTY: true } };

  // human at a real terminal -> interactive
  assert.equal(interactive({}, tty), true);
  // --json forces non-interactive even on a TTY (agents/scripts)
  assert.equal(interactive({ json: true }, tty), false);
  // piped/redirected stdin -> non-interactive
  assert.equal(interactive({}, piped), false);
  // no streams (e.g. detached) -> non-interactive
  assert.equal(interactive({}, { stdin: {}, stdout: {} }), false);
});

test("login points at the real Name.com API token page", () => {
  assert.equal(TOKEN_URL, "https://www.name.com/account/settings/api");
  assert.equal(typeof openUrl, "function");
});
