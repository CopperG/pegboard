import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setPegboardRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getPegboardRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("PegBoard runtime not initialized");
  }
  return runtime;
}
