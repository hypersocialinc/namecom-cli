// The one place that decides "is a human watching?". Every interactive flourish
// (prompts, spinners, color) is gated through here, so agents / CI / pipes /
// `--json` always get the exact same deterministic, non-interactive behavior.

import { spawn } from "node:child_process";
import * as clack from "@clack/prompts";
import pc from "picocolors";

// Best-effort "open this URL in the user's browser", cross-platform. Never
// throws — returns false if it couldn't launch a handler.
export function openUrl(url) {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
    return true;
  } catch {
    return false;
  }
}

// Prompts are allowed only when BOTH stdin and stdout are real TTYs and the
// caller didn't ask for JSON. `io` is injectable so this stays unit-testable.
export function interactive(opts = {}, io = process) {
  return Boolean(io.stdin?.isTTY && io.stdout?.isTTY && !opts.json);
}

// Run `fn`, showing a spinner only for interactive humans. In non-interactive
// mode it's a plain await — no control characters, no stdout noise.
export async function task(opts, message, fn) {
  if (!interactive(opts)) return fn();
  const s = clack.spinner();
  s.start(message);
  try {
    const result = await fn();
    s.stop(pc.green("✓ ") + message);
    return result;
  } catch (err) {
    s.stop(pc.red("✗ ") + message);
    throw err;
  }
}

export { clack, pc };
