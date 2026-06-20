// Credential resolution & storage.
// Precedence on read: explicit flags > env vars > OS keychain > config file.
// On write: macOS Keychain when available, else a 0600 config file.
//
// Keychain service names (namecom_user / namecom_token) are intentionally the
// same ones a manual `security add-generic-password` would use, so the CLI
// picks up creds you may already have stored.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, dirname } from "node:path";

const SVC_USER = "namecom_user";
const SVC_TOKEN = "namecom_token";

const account = () => process.env.USER || process.env.LOGNAME || "default";

function keychainGet(service) {
  if (platform() !== "darwin") return null;
  try {
    const out = execFileSync(
      "security",
      ["find-generic-password", "-a", account(), "-s", service, "-w"],
      { stdio: ["ignore", "pipe", "ignore"] }
    );
    return out.toString().replace(/\n$/, "") || null;
  } catch {
    return null;
  }
}

function keychainSet(service, value) {
  execFileSync(
    "security",
    ["add-generic-password", "-U", "-a", account(), "-s", service, "-w", value],
    { stdio: "ignore" }
  );
}

function configFile() {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "namecom", "credentials.json");
}

function configGet() {
  try {
    return JSON.parse(readFileSync(configFile(), "utf8"));
  } catch {
    return null;
  }
}

export function resolveCreds(opts = {}) {
  let user = opts.user || process.env.NAMECOM_USER || null;
  let token = opts.token || process.env.NAMECOM_TOKEN || null;

  if (!user) user = keychainGet(SVC_USER);
  if (!token) token = keychainGet(SVC_TOKEN);

  if (!user || !token) {
    const cfg = configGet();
    if (cfg) {
      user = user || cfg.user || null;
      token = token || cfg.token || null;
    }
  }
  return { user, token };
}

export function storeCreds(user, token) {
  if (platform() === "darwin") {
    keychainSet(SVC_USER, user);
    keychainSet(SVC_TOKEN, token);
    return "macOS Keychain";
  }
  const p = configFile();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ user, token }, null, 2), { mode: 0o600 });
  return p;
}
