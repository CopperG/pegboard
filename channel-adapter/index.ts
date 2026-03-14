import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { pegboardPlugin } from "./src/channel.js";
import { setPegboardRuntime } from "./src/runtime.js";

export { monitorPegboard } from "./src/monitor.js";
export { sendWsJson } from "./src/send.js";
export { pegboardPlugin } from "./src/channel.js";

const plugin = {
  id: "pegboard",
  name: "Lobster PegBoard",
  description: "Lobster PegBoard desktop canvas channel",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setPegboardRuntime(api.runtime);
    api.registerChannel({ plugin: pegboardPlugin });
  },
};

export default plugin;
