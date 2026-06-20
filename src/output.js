// Single place that decides JSON vs human output, so every command stays
// agent-friendly for free: pass --json anywhere and you get parseable data.

export function emit(data, opts = {}) {
  if (opts.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    return;
  }
  if (Array.isArray(data)) {
    if (!data.length) {
      console.log("(none)");
      return;
    }
    console.table(data);
  } else if (data && typeof data === "object") {
    console.table([data]);
  } else {
    console.log(String(data));
  }
}
